import {
  ANALYSIS_SCHEMA_VERSION,
  type AnalysisResponse,
  type FacingObservation,
  type PriceLabelObservation,
  type ProductMatch,
} from '@/contracts/analysis';

export const matched = (productId: string, providerScore = 0.9): ProductMatch => ({
  status: 'matched',
  productId,
  brandId: null,
  category: null,
  providerScore,
});

export const unknown = (category: ProductMatch['category'] = null): ProductMatch => ({
  status: 'unknown',
  productId: null,
  brandId: null,
  category,
  providerScore: null,
});

let seq = 0;
export function facing(
  locationId: string,
  imageId: string,
  match: ProductMatch,
  physicalPositionId: string | null = `pos-${++seq}`,
): FacingObservation {
  return {
    facingId: `f-${++seq}`,
    imageId,
    locationId,
    physicalPositionId,
    region: { x: 0.1, y: 0.1, width: 0.1, height: 0.1 },
    match,
  };
}

export function label(overrides: Partial<PriceLabelObservation> = {}): PriceLabelObservation {
  return {
    labelId: `l-${++seq}`,
    imageId: 'img-1',
    locationId: 'loc-shelf',
    physicalLabelId: null,
    region: null,
    rawText: '8,95',
    status: 'resolved',
    unresolvedReason: null,
    match: matched('pepsi-max-330'),
    priceType: 'regular',
    amountOre: 895,
    currency: 'DKK',
    deposit: { shown: true, amountOre: 100, included: false },
    pack: { units: null, volumeMl: null },
    multibuy: null,
    conditionText: null,
    promotionId: null,
    ...overrides,
  };
}

/** Shelf location with images img-1, img-2; cooler location with img-3. */
export function response(overrides: Partial<AnalysisResponse> = {}): AnalysisResponse {
  return {
    schemaVersion: ANALYSIS_SCHEMA_VERSION,
    jobId: 'job-1',
    visitId: 'visit-1',
    status: 'completed',
    source: 'mock',
    provider: { name: 'test', model: null },
    methodVersion: 'test-v1',
    catalogueVersion: 'dk-seed-2026.11',
    analysedAt: '2026-11-10T13:38:00.000Z',
    images: [
      {
        imageId: 'img-1',
        usable: true,
        locationType: 'shelf',
        locationId: 'loc-shelf',
        issues: [],
      },
      {
        imageId: 'img-2',
        usable: true,
        locationType: 'shelf',
        locationId: 'loc-shelf',
        issues: [],
      },
      {
        imageId: 'img-3',
        usable: true,
        locationType: 'cooler',
        locationId: 'loc-cooler',
        issues: [],
      },
    ],
    locations: [
      { locationId: 'loc-shelf', type: 'shelf', label: 'Shelf 1', imageIds: ['img-1', 'img-2'] },
      { locationId: 'loc-cooler', type: 'cooler', label: 'Cooler 1', imageIds: ['img-3'] },
    ],
    facings: [],
    priceLabels: [],
    promotions: [],
    displays: [],
    warnings: [],
    failure: null,
    narrative: null,
    ...overrides,
  };
}
