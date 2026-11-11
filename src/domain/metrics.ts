import type {
  AnalysisResponse,
  AnalysisWarning,
  DisplayObservation,
  LocationType,
  PromotionObservation,
} from '@/contracts/analysis';
import type { CatalogueIndex } from './catalogue';
import {
  applyFacingCorrections,
  type Correction,
  type EffectiveFacing,
  type FacingCorrection,
  type PriceCorrection,
} from './corrections';
import { reconcileFacings } from './overlap';
import { normalisePrices, type NormalisedPrice } from './pricing';
import {
  combineCoverage,
  measureCategorySos,
  measureSos,
  SOS_METHOD_VERSION,
  type CategorySos,
  type ScopeCoverage,
  type SosMeasure,
  type SosScope,
} from './sos';

export interface ShareGroup {
  id: string;
  kind: 'client' | 'competitor' | 'unknown';
  label: string;
  facings: number;
  sharePct: number;
}

export interface ScopeMetrics {
  sos: SosMeasure;
  categories: CategorySos[];
  uncategorisedFacings: number;
  groups: ShareGroup[];
  coverage: ScopeCoverage;
}

export interface ObservedProduct {
  /** productId, or `brand:<id>` when only the brand was identified. */
  key: string;
  productId: string | null;
  brandId: string;
  facings: Record<'shelf' | 'cooler', number>;
}

export interface VisitMetrics {
  methodVersion: string;
  catalogueVersion: string;
  source: AnalysisResponse['source'];
  scopes: Record<SosScope, ScopeMetrics>;
  clientProducts: ObservedProduct[];
  /** Distinct recognised client SKUs (brand-only identifications are not SKUs). */
  uniqueClientSkus: number;
  prices: NormalisedPrice[];
  promotions: PromotionObservation[];
  displays: { count: number; withClientBrand: number; items: DisplayObservation[] };
  unresolved: { facings: number; prices: number };
  provenance: { correctedFacings: number; correctedPrices: number };
  coverage: {
    imagesSubmitted: number;
    imagesUsable: number;
    locations: Record<LocationType, number>;
    observations: number;
    duplicatesMerged: number;
  };
  warnings: AnalysisWarning[];
  facings: EffectiveFacing[];
}

export function computeVisitMetrics(
  response: AnalysisResponse,
  corrections: readonly Correction[],
  catalogue: CatalogueIndex,
): VisitMetrics {
  const facingCorrections = corrections.filter(
    (c): c is FacingCorrection => c.targetKind === 'facing',
  );
  const priceCorrections = corrections.filter(
    (c): c is PriceCorrection => c.targetKind === 'price-label',
  );

  const reconciled = reconcileFacings(response.facings, response.locations);
  const facings = applyFacingCorrections(reconciled.facings, facingCorrections, catalogue);
  const unreconciled = new Set(reconciled.unreconciledLocationIds);

  const coverageFor = (type: LocationType): ScopeCoverage => {
    const locations = response.locations.filter((l) => l.type === type);
    return {
      locations: locations.length,
      usableImages: response.images.filter((i) => i.usable && i.locationType === type).length,
      unreconciledOverlap: locations.some((l) => unreconciled.has(l.locationId)),
    };
  };
  const counted = (type: LocationType) =>
    facings.filter((f) => !f.excluded && f.locationType === type);

  const shelfCoverage = coverageFor('shelf');
  const coolerCoverage = coverageFor('cooler');
  const scope = (s: SosScope, scoped: EffectiveFacing[], coverage: ScopeCoverage): ScopeMetrics => {
    const { categories, uncategorised } = measureCategorySos(s, scoped, coverage);
    return {
      sos: measureSos(s, scoped, coverage),
      categories,
      uncategorisedFacings: uncategorised,
      groups: shareGroups(scoped, catalogue),
      coverage,
    };
  };
  const shelfFacings = counted('shelf');
  const coolerFacings = counted('cooler');

  const prices = normalisePrices(response.priceLabels, catalogue, priceCorrections);
  const clientProducts = observedClientProducts(facings);
  const clientBrandIds = new Set(
    catalogue.brands.filter((b) => b.relation !== 'competitor').map((b) => b.id),
  );

  return {
    methodVersion: SOS_METHOD_VERSION,
    catalogueVersion: response.catalogueVersion,
    source: response.source,
    scopes: {
      shelf: scope('shelf', shelfFacings, shelfCoverage),
      cooler: scope('cooler', coolerFacings, coolerCoverage),
      overall: scope(
        'overall',
        [...shelfFacings, ...coolerFacings],
        combineCoverage(shelfCoverage, coolerCoverage),
      ),
    },
    clientProducts,
    uniqueClientSkus: clientProducts.filter((p) => p.productId !== null).length,
    prices,
    promotions: response.promotions,
    displays: {
      count: response.locations.filter((l) => l.type === 'display').length,
      withClientBrand: response.displays.filter((d) =>
        d.brandIds.some((b) => clientBrandIds.has(b)),
      ).length,
      items: response.displays,
    },
    unresolved: {
      facings: facings.filter((f) => f.needsReview && f.locationType !== 'display').length,
      prices: prices.filter((p) => p.needsReview).length,
    },
    provenance: {
      correctedFacings: facings.filter((f) => f.source === 'rep').length,
      correctedPrices: prices.filter((p) => p.source === 'rep').length,
    },
    coverage: {
      imagesSubmitted: response.images.length,
      imagesUsable: response.images.filter((i) => i.usable).length,
      locations: {
        shelf: shelfCoverage.locations,
        cooler: coolerCoverage.locations,
        display: response.locations.filter((l) => l.type === 'display').length,
      },
      observations: reconciled.observationCount,
      duplicatesMerged: reconciled.duplicatesMerged,
    },
    warnings: response.warnings,
    facings,
  };
}

/** Client vs each competitor company vs unknown, as shares of the same denominator. */
export function shareGroups(
  facings: readonly EffectiveFacing[],
  catalogue: CatalogueIndex,
): ShareGroup[] {
  const total = facings.length;
  if (total === 0) return [];
  const counts = new Map<string, ShareGroup>();
  const bump = (id: string, kind: ShareGroup['kind'], label: string) => {
    const g = counts.get(id) ?? { id, kind, label, facings: 0, sharePct: 0 };
    g.facings += 1;
    counts.set(id, g);
  };
  for (const f of facings) {
    if (f.classification === 'client') bump('client', 'client', catalogue.client.name);
    else if (f.classification === 'competitor' && f.brandId) {
      const company = catalogue.brandById.get(f.brandId)?.company ?? 'Other';
      bump(`company:${company}`, 'competitor', company);
    } else bump('unknown', 'unknown', 'Unknown');
  }
  return [...counts.values()]
    .map((g) => ({ ...g, sharePct: (g.facings / total) * 100 }))
    .sort((a, b) => {
      const rank = (g: ShareGroup) => (g.kind === 'client' ? 0 : g.kind === 'competitor' ? 1 : 2);
      return rank(a) - rank(b) || b.facings - a.facings;
    });
}

function observedClientProducts(facings: readonly EffectiveFacing[]): ObservedProduct[] {
  const byKey = new Map<string, ObservedProduct>();
  for (const f of facings) {
    if (f.excluded || f.classification !== 'client' || !f.brandId) continue;
    if (f.locationType === 'display') continue;
    const key = f.productId ?? `brand:${f.brandId}`;
    const entry =
      byKey.get(key) ??
      ({
        key,
        productId: f.productId,
        brandId: f.brandId,
        facings: { shelf: 0, cooler: 0 },
      } as ObservedProduct);
    entry.facings[f.locationType] += 1;
    byKey.set(key, entry);
  }
  return [...byKey.values()].sort(
    (a, b) => b.facings.shelf + b.facings.cooler - (a.facings.shelf + a.facings.cooler),
  );
}
