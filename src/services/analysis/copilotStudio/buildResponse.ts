import type { PhotoFacingGroup, PhotoPriceLabel, PhotoResult } from '@/contracts/agentPhoto';
import {
  ANALYSIS_SCHEMA_VERSION,
  type AnalysisLocation,
  type AnalysisRequest,
  type AnalysisResponse,
  type AnalysisWarning,
  type FacingObservation,
  type LocationType,
  type PriceLabelObservation,
  type ProductMatch,
  type Region,
} from '@/contracts/analysis';
import type { CatalogueIndex } from '@/domain/catalogue';

export const COPILOT_STUDIO_PROVIDER_ID = 'copilot-studio';
export const COPILOT_STUDIO_METHOD_VERSION = 'copilot-studio-photo-v1';

/** Facings this close to the overlap edge (fraction of photo width) count as inside it. */
const OVERLAP_TOLERANCE = 0.04;

export interface PhotoOutcome {
  imageId: string;
  /** null when the agent's reply could not be used (counted as an unusable image). */
  result: PhotoResult | null;
}

const ore = (dkk: number | null) => (dkk === null ? null : Math.round(dkk * 100));

/** Clamps a model box into a valid normalised region; null if nothing is left of it. */
export function toRegion(box: number[] | null | undefined): Region | null {
  if (!box || box.length !== 4 || box.some((n) => !Number.isFinite(n))) return null;
  const x = Math.min(1, Math.max(0, box[0]));
  const y = Math.min(1, Math.max(0, box[1]));
  const width = Math.min(1 - x, Math.max(0, box[2]));
  const height = Math.min(1 - y, Math.max(0, box[3]));
  if (width < 0.001 || height < 0.001) return null;
  return { x, y, width, height };
}

/** A group box spanning `count` identical facings, split into equal columns. */
export function splitRegion(region: Region | null, count: number): (Region | null)[] {
  if (!region || count <= 1) return Array.from({ length: Math.max(1, count) }, () => region);
  const width = region.width / count;
  return Array.from({ length: count }, (_, i) => ({ ...region, x: region.x + i * width, width }));
}

/**
 * Keeps only ids that exist in our catalogue. A "matched" claim without a known product or
 * brand becomes "unknown" (never silently dropped, never trusted).
 */
export function resolveMatch(
  catalogue: CatalogueIndex,
  claim: Pick<PhotoFacingGroup, 'status' | 'brandId' | 'productId' | 'category' | 'score'>,
): { match: ProductMatch; downgraded: boolean } {
  const product = claim.productId ? catalogue.productById.get(claim.productId) : undefined;
  const brand = product
    ? catalogue.brandById.get(product.brandId)
    : claim.brandId
      ? catalogue.brandById.get(claim.brandId)
      : undefined;
  const claimed = claim.status !== 'unknown';
  if (!claimed || (!product && !brand)) {
    return {
      match: {
        status: 'unknown',
        productId: null,
        brandId: null,
        category: claim.category,
        providerScore: null,
      },
      downgraded: claimed,
    };
  }
  return {
    match: {
      status: claim.status,
      productId: product?.id ?? null,
      brandId: brand?.id ?? null,
      category: product?.category ?? brand?.category ?? claim.category,
      providerScore: claim.score,
    },
    downgraded: Boolean(claim.productId && !product),
  };
}

const centreX = (f: FacingObservation) => (f.region ? f.region.x + f.region.width / 2 : null);

/**
 * Merges per-photo agent results into one `AnalysisResponse`.
 *
 * Consecutive photos from the same left-to-right run (overlap guide `placement`) and of the same
 * location type form one location. Facings inside the estimated overlap of two neighbouring
 * photos are paired by order and share a `physicalPositionId` when both sides agree on the
 * count; otherwise they stay unreconciled (null), so the location is qualified, never silently
 * double-counted.
 */
export function buildResponse(input: {
  request: AnalysisRequest;
  photos: PhotoOutcome[];
  catalogue: CatalogueIndex;
  analysedAt: string;
  model: string | null;
}): AnalysisResponse {
  const { request, catalogue } = input;
  const byId = new Map(input.photos.map((p) => [p.imageId, p.result]));
  const images = [...request.images].sort((a, b) => a.sequence - b.sequence);
  const warnings: AnalysisWarning[] = [];
  const unusable: string[] = [];
  const uncertain = new Set<string>();
  const unreconciled = new Set<string>();

  const analysedImages: AnalysisResponse['images'] = [];
  const locations: AnalysisLocation[] = [];
  const facings: FacingObservation[] = [];
  const priceLabels: PriceLabelObservation[] = [];
  const promotions: AnalysisResponse['promotions'] = [];
  const displays: AnalysisResponse['displays'] = [];
  const counters: Record<LocationType, number> = { shelf: 0, cooler: 0, display: 0 };
  let previous: { type: LocationType; run: number; position: number } | null = null;
  let current: AnalysisLocation | null = null;
  let previousFacings: FacingObservation[] = [];

  for (const image of images) {
    const result = byId.get(image.imageId) ?? null;
    if (!result || !result.usable || !result.locationType) {
      analysedImages.push({
        imageId: image.imageId,
        usable: false,
        locationType: result?.locationType ?? null,
        locationId: null,
        issues: result?.issues ?? [],
      });
      unusable.push(image.imageId);
      previous = null;
      current = null;
      previousFacings = [];
      continue;
    }

    const type = result.locationType;
    const placement = image.placement ?? null;
    const continues =
      previous !== null &&
      current !== null &&
      placement !== null &&
      previous.type === type &&
      previous.run === placement.run &&
      previous.position + 1 === placement.position;
    if (!continues || !current) {
      counters[type] += 1;
      const label = `${type[0].toUpperCase()}${type.slice(1)} ${counters[type]}`;
      current = { locationId: `loc-${image.imageId}`, type, label, imageIds: [] };
      locations.push(current);
      previousFacings = [];
    }
    current.imageIds.push(image.imageId);
    const locationId = current.locationId;
    analysedImages.push({
      imageId: image.imageId,
      usable: true,
      locationType: type,
      locationId,
      issues: result.issues,
    });

    // Facings: each group expands into `count` observations.
    const imageFacings: FacingObservation[] = [];
    result.facings.forEach((group, g) => {
      const { match, downgraded } = resolveMatch(catalogue, group);
      if (downgraded) uncertain.add(image.imageId);
      splitRegion(toRegion(group.box), group.count).forEach((region, i) => {
        const facingId = `${image.imageId}-f${g + 1}-${i + 1}`;
        imageFacings.push({
          facingId,
          imageId: image.imageId,
          locationId,
          physicalPositionId: `pp-${facingId}`,
          region,
          match,
        });
      });
    });

    if (continues) {
      pairOverlap(previousFacings, imageFacings, placement!.overlap, () =>
        unreconciled.add(image.imageId),
      );
    }
    facings.push(...imageFacings);
    previousFacings = imageFacings;

    result.priceLabels.forEach((label, i) => {
      const mapped = mapPriceLabel(catalogue, label);
      if (mapped.downgraded) uncertain.add(image.imageId);
      priceLabels.push({
        labelId: `${image.imageId}-l${i + 1}`,
        imageId: image.imageId,
        locationId,
        physicalLabelId: null,
        region: toRegion(label.box),
        ...mapped.label,
      });
    });
    result.promotions.forEach((p, i) => {
      promotions.push({
        promotionId: `${image.imageId}-p${i + 1}`,
        imageId: image.imageId,
        region: toRegion(p.box),
        mechanic: p.mechanic,
        headline: p.headline || p.conditionText || '—',
        conditionText: p.conditionText,
        productIds: p.productIds.filter((id) => catalogue.productById.has(id)),
        brandIds: p.brandIds.filter((id) => catalogue.brandById.has(id)),
      });
    });
    result.displays.forEach((d, i) => {
      displays.push({
        displayId: `${image.imageId}-d${i + 1}`,
        imageId: image.imageId,
        locationId,
        region: toRegion(d.box),
        brandIds: d.brandIds.filter((id) => catalogue.brandById.has(id)),
        description: d.description || '—',
      });
    });

    // Photos without placement (imports) never continue a location.
    previous = placement ? { type, run: placement.run, position: placement.position } : null;
  }

  if (unusable.length)
    warnings.push({
      code: 'unusable-image',
      message: `${unusable.length} photo(s) could not be analysed.`,
      imageIds: unusable,
    });
  if (uncertain.size)
    warnings.push({
      code: 'classification-uncertain',
      message: 'Some products were named outside the catalogue and are treated as unknown.',
      imageIds: [...uncertain],
    });
  if (unreconciled.size)
    warnings.push({
      code: 'overlap-unreconciled',
      message: 'Overlapping photos could not be matched exactly; counts may include duplicates.',
      imageIds: [...unreconciled],
    });
  const unreadable = priceLabels.filter((p) => p.unresolvedReason === 'unreadable');
  if (unreadable.length)
    warnings.push({
      code: 'label-unreadable',
      message: `${unreadable.length} price label(s) were unreadable.`,
      imageIds: [...new Set(unreadable.map((p) => p.imageId))],
    });

  const usableCount = analysedImages.filter((i) => i.usable).length;
  return {
    schemaVersion: ANALYSIS_SCHEMA_VERSION,
    jobId: request.jobId,
    visitId: request.visitId,
    status: unusable.length && usableCount ? 'partial' : 'completed',
    source: 'live',
    provider: { name: COPILOT_STUDIO_PROVIDER_ID, model: input.model },
    methodVersion: COPILOT_STUDIO_METHOD_VERSION,
    catalogueVersion: catalogue.version,
    analysedAt: input.analysedAt,
    images: analysedImages,
    locations,
    facings,
    priceLabels,
    promotions,
    displays,
    warnings,
    failure: null,
    narrative: null,
  };
}

/**
 * Pairs the facings in the right edge of the previous photo with those in the left edge of
 * this one (inside the estimated overlap), by left-to-right order. Without an estimate, or if
 * the two sides disagree on the count, the candidates stay unreconciled.
 */
export function pairOverlap(
  left: FacingObservation[],
  right: FacingObservation[],
  overlap: number | null,
  onUnreconciled: () => void,
) {
  if (overlap === null) {
    // Unknown overlap: any facing may be a duplicate, so none of this photo is reconciled.
    right.forEach((f) => (f.physicalPositionId = null));
    if (right.length) onUnreconciled();
    return;
  }
  const byX = (a: FacingObservation, b: FacingObservation) => centreX(a)! - centreX(b)!;
  const leftEdge = left
    .filter((f) => (centreX(f) ?? -1) >= 1 - overlap - OVERLAP_TOLERANCE)
    .sort(byX);
  const rightEdge = right
    .filter((f) => {
      const x = centreX(f);
      return x !== null && x <= overlap + OVERLAP_TOLERANCE;
    })
    .sort(byX);
  let reconciled = true;
  if (leftEdge.length === rightEdge.length) {
    rightEdge.forEach((f, i) => (f.physicalPositionId = leftEdge[i].physicalPositionId));
  } else {
    [...leftEdge, ...rightEdge].forEach((f) => (f.physicalPositionId = null));
    reconciled = false;
  }
  // Facings without a box can't be placed, so they may be duplicates too.
  const unboxed = right.filter((f) => f.region === null);
  unboxed.forEach((f) => (f.physicalPositionId = null));
  if (!reconciled || unboxed.length) onUnreconciled();
}

function mapPriceLabel(catalogue: CatalogueIndex, label: PhotoPriceLabel) {
  const { match, downgraded } = resolveMatch(catalogue, {
    status: label.productId || label.brandId ? 'candidate' : 'unknown',
    productId: label.productId,
    brandId: label.brandId,
    category: null,
    score: null,
  });
  const resolved = label.status === 'resolved' && label.priceDkk !== null;
  const out: Omit<
    PriceLabelObservation,
    'labelId' | 'imageId' | 'locationId' | 'physicalLabelId' | 'region'
  > = {
    rawText: label.rawText,
    status: resolved ? 'resolved' : 'unresolved',
    unresolvedReason: resolved ? null : (label.unresolvedReason ?? 'unreadable'),
    // A readable label tied to a catalogue product is a match; otherwise a candidate/unknown.
    match: resolved && match.productId ? { ...match, status: 'matched' } : match,
    priceType: label.priceType,
    amountOre: ore(label.priceDkk),
    currency: 'DKK',
    deposit: {
      shown: label.deposit.shown,
      amountOre: ore(label.deposit.dkk),
      included: label.deposit.included,
    },
    pack: label.pack,
    multibuy: label.multibuy
      ? { quantity: label.multibuy.quantity, totalOre: ore(label.multibuy.totalDkk)! }
      : null,
    conditionText: label.conditionText,
    promotionId: null,
  };
  return { label: out, downgraded };
}
