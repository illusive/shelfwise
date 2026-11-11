import type { Category } from './categories';
import { isClientRelation, resolveBrand, type CatalogueIndex } from './catalogue';
import type { ReconciledFacing } from './overlap';

export type FacingCorrectionValue =
  | { kind: 'product'; productId: string }
  | { kind: 'brand'; brandId: string }
  /** Rep confirms it cannot be identified; stays unknown but no longer needs review. */
  | { kind: 'unknown' }
  /** Not a beverage facing (e.g. a shelf divider); removed from the denominator. */
  | { kind: 'not-beverage' };

export type PriceCorrectionValue =
  | { kind: 'price'; amountOre: number; priceType: 'regular' | 'promotion' | 'member' }
  | { kind: 'unreadable' };

interface CorrectionBase {
  id: string;
  resultId: string;
  visitId: string;
  repId: string;
  createdAt: string;
}

/** Rep corrections are stored next to, never instead of, the provider's values. */
export type Correction = CorrectionBase &
  (
    | { targetKind: 'facing'; targetId: string; value: FacingCorrectionValue }
    | { targetKind: 'price-label'; targetId: string; value: PriceCorrectionValue }
  );

export type FacingCorrection = Extract<Correction, { targetKind: 'facing' }>;
export type PriceCorrection = Extract<Correction, { targetKind: 'price-label' }>;

export type FacingClass = 'client' | 'competitor' | 'unknown';
export type Provenance = 'ai' | 'rep';

export interface EffectiveFacing extends ReconciledFacing {
  classification: FacingClass;
  productId: string | null;
  brandId: string | null;
  category: Category | null;
  excluded: boolean;
  source: Provenance;
  needsReview: boolean;
}

/** Latest correction per target wins. */
export function latestCorrections<T extends Correction>(corrections: readonly T[]): Map<string, T> {
  const sorted = [...corrections].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return new Map(sorted.map((c) => [c.targetId, c]));
}

export function applyFacingCorrections(
  facings: readonly ReconciledFacing[],
  corrections: readonly FacingCorrection[],
  catalogue: CatalogueIndex,
): EffectiveFacing[] {
  const byKey = latestCorrections(corrections);
  return facings.map((f) => {
    const correction = byKey.get(f.key);
    if (correction) return withCorrection(f, correction.value, catalogue);
    return classifyAiFacing(f, catalogue);
  });
}

function classifyAiFacing(f: ReconciledFacing, catalogue: CatalogueIndex): EffectiveFacing {
  const { match } = f;
  const unresolved = match.status !== 'matched' || f.conflict;
  const brand =
    match.status === 'matched'
      ? resolveBrand(catalogue, match.productId, match.brandId)
      : undefined;
  const product = match.productId ? catalogue.productById.get(match.productId) : undefined;
  return {
    ...f,
    classification: brand
      ? isClientRelation(brand.relation)
        ? 'client'
        : 'competitor'
      : 'unknown',
    productId: brand ? (product?.id ?? null) : null,
    brandId: brand?.id ?? null,
    category: product?.category ?? brand?.category ?? match.category,
    excluded: false,
    source: 'ai',
    needsReview: unresolved || !brand,
  };
}

function withCorrection(
  f: ReconciledFacing,
  value: FacingCorrectionValue,
  catalogue: CatalogueIndex,
): EffectiveFacing {
  const base = { ...f, source: 'rep' as const, needsReview: false, excluded: false };
  switch (value.kind) {
    case 'not-beverage':
      return {
        ...base,
        classification: 'unknown',
        productId: null,
        brandId: null,
        category: null,
        excluded: true,
      };
    case 'unknown':
      return {
        ...base,
        classification: 'unknown',
        productId: null,
        brandId: null,
        category: f.match.category,
      };
    case 'product':
    case 'brand': {
      const productId = value.kind === 'product' ? value.productId : null;
      const brand = resolveBrand(
        catalogue,
        productId,
        value.kind === 'brand' ? value.brandId : null,
      );
      const product = productId ? catalogue.productById.get(productId) : undefined;
      if (!brand) {
        return {
          ...base,
          classification: 'unknown',
          productId: null,
          brandId: null,
          category: f.match.category,
        };
      }
      return {
        ...base,
        classification: isClientRelation(brand.relation) ? 'client' : 'competitor',
        productId: product?.id ?? null,
        brandId: brand.id,
        category: product?.category ?? brand.category,
      };
    }
  }
}
