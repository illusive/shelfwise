import type { PriceLabelObservation, Region } from '@/contracts/analysis';
import { isClientRelation, resolveBrand, type CatalogueIndex } from './catalogue';
import {
  latestCorrections,
  type FacingClass,
  type PriceCorrection,
  type Provenance,
} from './corrections';

/**
 * `ex-deposit`: pant known to be excluded (or subtracted). `incl-deposit`: pant included but
 * its amount unknown. `as-displayed`: the label does not say. Prices are only comparable
 * within the same basis.
 */
export type PriceBasis = 'ex-deposit' | 'incl-deposit' | 'as-displayed';

export interface NormalisedPrice {
  labelId: string;
  physicalLabelId: string | null;
  imageId: string;
  region: Region | null;
  locationId: string | null;
  productId: string | null;
  brandId: string | null;
  classification: FacingClass;
  status: 'resolved' | 'unresolved';
  unresolvedReason: PriceLabelObservation['unresolvedReason'];
  priceType: PriceLabelObservation['priceType'];
  rawText: string | null;
  displayedOre: number | null;
  deposit: PriceLabelObservation['deposit'];
  basis: PriceBasis | null;
  /** Displayed price with known deposit removed; otherwise as displayed (see basis). */
  basePriceOre: number | null;
  /** The purchase condition is kept; the per-item price is an additional derived value. */
  multibuy: { quantity: number; totalOre: number; perItemOre: number } | null;
  pack: { units: number; volumeMl: number } | null;
  packSource: 'label' | 'catalogue' | null;
  /** Only when quantity and unit are known. */
  pricePerLitreOre: number | null;
  conditionText: string | null;
  promotionId: string | null;
  /** Same product, same pack, same basis and price type. Different packs never compare. */
  comparableKey: string | null;
  source: Provenance;
  needsReview: boolean;
}

export function priceBasis(deposit: PriceLabelObservation['deposit']): PriceBasis {
  if (deposit.included === false) return 'ex-deposit';
  if (deposit.included === true) return deposit.amountOre !== null ? 'ex-deposit' : 'incl-deposit';
  return 'as-displayed';
}

export function basePrice(displayedOre: number, deposit: PriceLabelObservation['deposit']): number {
  if (deposit.included === true && deposit.amountOre !== null) {
    return Math.max(0, displayedOre - deposit.amountOre);
  }
  return displayedOre;
}

export function pricePerLitre(priceOre: number, pack: { units: number; volumeMl: number }): number {
  return Math.round(priceOre / ((pack.units * pack.volumeMl) / 1000));
}

export function normalisePrice(
  label: PriceLabelObservation,
  catalogue: CatalogueIndex,
  correction?: PriceCorrection,
): NormalisedPrice {
  let status = label.status;
  let unresolvedReason = label.unresolvedReason;
  let priceType = label.priceType;
  let displayedOre = label.amountOre;
  let source: Provenance = 'ai';
  if (correction) {
    source = 'rep';
    if (correction.value.kind === 'price') {
      status = 'resolved';
      unresolvedReason = null;
      displayedOre = correction.value.amountOre;
      priceType = correction.value.priceType;
    } else {
      status = 'unresolved';
      unresolvedReason = 'unreadable';
      displayedOre = null;
    }
  }

  // Only a confirmed match ties a price to a product.
  const matched = label.match.status === 'matched';
  const brand = matched
    ? resolveBrand(catalogue, label.match.productId, label.match.brandId)
    : undefined;
  const product =
    matched && label.match.productId ? catalogue.productById.get(label.match.productId) : undefined;

  let pack: NormalisedPrice['pack'] = null;
  let packSource: NormalisedPrice['packSource'] = null;
  if (label.pack.units !== null && label.pack.volumeMl !== null) {
    pack = { units: label.pack.units, volumeMl: label.pack.volumeMl };
    packSource = 'label';
  } else if (product) {
    pack = { units: product.pack.units, volumeMl: product.pack.volumeMl };
    packSource = 'catalogue';
  }

  const resolved = status === 'resolved' && displayedOre !== null;
  const basis = resolved ? priceBasis(label.deposit) : null;
  const base = resolved ? basePrice(displayedOre!, label.deposit) : null;
  const perLitre = base !== null && pack ? pricePerLitre(base, pack) : null;
  const multibuy = label.multibuy
    ? {
        ...label.multibuy,
        perItemOre: Math.round(label.multibuy.totalOre / label.multibuy.quantity),
      }
    : null;

  return {
    labelId: label.labelId,
    physicalLabelId: label.physicalLabelId,
    imageId: label.imageId,
    region: label.region,
    locationId: label.locationId,
    productId: product?.id ?? null,
    brandId: brand?.id ?? null,
    classification: brand
      ? isClientRelation(brand.relation)
        ? 'client'
        : 'competitor'
      : 'unknown',
    status,
    unresolvedReason,
    priceType,
    rawText: label.rawText,
    displayedOre,
    deposit: label.deposit,
    basis,
    basePriceOre: base,
    multibuy,
    pack,
    packSource,
    pricePerLitreOre: perLitre,
    conditionText: label.conditionText,
    promotionId: label.promotionId,
    comparableKey:
      product && pack && basis
        ? `${product.id}|${pack.units}x${pack.volumeMl}|${basis}|${priceType}`
        : null,
    source,
    needsReview: label.status === 'unresolved' && !correction,
  };
}

/**
 * The same physical label seen in overlapping photos is listed once, preferring a resolved
 * reading.
 */
export function dedupeLabels(labels: readonly PriceLabelObservation[]): PriceLabelObservation[] {
  const byPhysical = new Map<string, PriceLabelObservation>();
  const result: PriceLabelObservation[] = [];
  for (const label of labels) {
    if (label.physicalLabelId === null) {
      result.push(label);
      continue;
    }
    const existing = byPhysical.get(label.physicalLabelId);
    if (!existing || (existing.status === 'unresolved' && label.status === 'resolved')) {
      byPhysical.set(label.physicalLabelId, label);
    }
  }
  return [...result, ...byPhysical.values()];
}

export function normalisePrices(
  labels: readonly PriceLabelObservation[],
  catalogue: CatalogueIndex,
  corrections: readonly PriceCorrection[],
): NormalisedPrice[] {
  const byLabel = latestCorrections(corrections);
  return dedupeLabels(labels).map((l) => normalisePrice(l, catalogue, byLabel.get(l.labelId)));
}
