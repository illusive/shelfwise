import type { Region } from '@/contracts/analysis';
import { resolveBrand, type CatalogueIndex } from '@/domain/catalogue';
import type { Correction } from '@/domain/corrections';
import type { Capture, StoredResult, Visit } from '@/domain/models';
import { facingKey } from '@/domain/overlap';
import {
  categoryId,
  COCO_CATEGORIES,
  CORRECTIONS_LAYER_VERSION,
  type CocoCategoryName,
} from './format';

export interface ExportVisit {
  visit: Visit;
  captures: Capture[];
  result: StoredResult;
  corrections: Correction[];
}

export interface CocoImage {
  id: number;
  file_name: string;
  width: number;
  height: number;
  date_captured: string;
  license: number;
  shelfwise: {
    imageId: string;
    visitId: string;
    sequence: number;
    usable: boolean | null;
    locationType: string | null;
    locationId: string | null;
    issues: string[];
  };
}

export interface CocoAnnotation {
  id: number;
  image_id: number;
  category_id: number;
  /** [x, y, width, height] in pixels from the top-left corner (COCO convention). */
  bbox: [number, number, number, number];
  area: number;
  iscrowd: 0;
  segmentation: [];
  /** Draft label details from the analysis provider (not human-verified). */
  attributes: Record<string, unknown> & {
    kind: CocoCategoryName;
    observationId: string;
    source: 'mock' | 'live';
    needsReview: boolean;
  };
  /** The provider's own score, kept apart from the label; not a validated accuracy. */
  provider_score: number | null;
}

export interface CocoDataset {
  info: { description: string; version: string; date_created: string };
  licenses: { id: number; name: string; url: string }[];
  categories: typeof COCO_CATEGORIES;
  images: CocoImage[];
  annotations: CocoAnnotation[];
}

export interface CorrectionEntry {
  correctionId: string;
  visitId: string;
  resultId: string;
  targetKind: Correction['targetKind'];
  targetId: string;
  /** COCO annotations the correction applies to (empty when the target had no box). */
  annotationIds: number[];
  /** Provider observation ids (facingId / labelId) the correction applies to. */
  observationIds: string[];
  value: Correction['value'];
  createdAt: string;
  /** The newest correction per target wins; older ones are kept for audit. */
  latest: boolean;
}

export interface CorrectionsLayer {
  format: 'shelfwise-corrections';
  version: string;
  corrections: CorrectionEntry[];
}

export interface LabelStats {
  images: number;
  annotations: Record<CocoCategoryName, number>;
  /** Observations the provider reported without a box (counted, not exported as boxes). */
  withoutBox: number;
  needsReview: number;
  corrections: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function toPixelBox(region: Region, width: number, height: number) {
  const bbox: [number, number, number, number] = [
    round1(region.x * width),
    round1(region.y * height),
    round1(region.width * width),
    round1(region.height * height),
  ];
  return { bbox, area: round1(bbox[2] * bbox[3]) };
}

/**
 * Converts analysis observations into COCO draft labels (one category per observation kind,
 * product details as attributes) and rep corrections into a separate layer that references the
 * annotations. `fileNames` maps capture id → path inside the package.
 */
export function buildLabels(
  visits: readonly ExportVisit[],
  catalogue: CatalogueIndex,
  fileNames: ReadonlyMap<string, string>,
  createdAt: string,
): { coco: CocoDataset; corrections: CorrectionsLayer; stats: LabelStats } {
  const images: CocoImage[] = [];
  const annotations: CocoAnnotation[] = [];
  const correctionEntries: CorrectionEntry[] = [];
  const stats: LabelStats = {
    images: 0,
    annotations: { facing: 0, price_label: 0, promotion: 0, display: 0 },
    withoutBox: 0,
    needsReview: 0,
    corrections: 0,
  };

  for (const { visit, captures, result, corrections } of visits) {
    const response = result.response;
    const source = response.source;
    const imageIdByCapture = new Map<string, number>();
    const captureById = new Map(captures.map((c) => [c.id, c]));
    const analysisById = new Map(response.images.map((i) => [i.imageId, i]));
    const locationType = new Map(response.locations.map((l) => [l.locationId, l.type]));

    for (const capture of captures) {
      const file = fileNames.get(capture.id);
      if (!file) continue;
      const analysis = analysisById.get(capture.id);
      const id = images.length + 1;
      imageIdByCapture.set(capture.id, id);
      images.push({
        id,
        file_name: file,
        width: capture.width,
        height: capture.height,
        date_captured: capture.capturedAt,
        license: 1,
        shelfwise: {
          imageId: capture.id,
          visitId: visit.id,
          sequence: capture.sequence,
          usable: analysis?.usable ?? null,
          locationType: analysis?.locationType ?? null,
          locationId: analysis?.locationId ?? null,
          issues: analysis?.issues ?? [],
        },
      });
    }

    const annotationIdsByObservation = new Map<string, number>();
    const add = (
      kind: CocoCategoryName,
      imageId: string,
      region: Region | null,
      attributes: Record<string, unknown> & { observationId: string; needsReview: boolean },
      providerScore: number | null,
    ) => {
      const image = imageIdByCapture.get(imageId);
      const capture = captureById.get(imageId);
      if (!image || !capture) return;
      if (!region) {
        stats.withoutBox += 1;
        return;
      }
      const { bbox, area } = toPixelBox(region, capture.width, capture.height);
      const id = annotations.length + 1;
      annotations.push({
        id,
        image_id: image,
        category_id: categoryId(kind),
        bbox,
        area,
        iscrowd: 0,
        segmentation: [],
        attributes: { kind, source, ...attributes },
        provider_score: providerScore,
      });
      annotationIdsByObservation.set(`${kind}:${attributes.observationId}`, id);
      stats.annotations[kind] += 1;
      if (attributes.needsReview) stats.needsReview += 1;
    };

    for (const f of response.facings) {
      const brand =
        f.match.status === 'unknown'
          ? undefined
          : resolveBrand(catalogue, f.match.productId, f.match.brandId);
      add(
        'facing',
        f.imageId,
        f.region,
        {
          observationId: f.facingId,
          facingKey: facingKey(f),
          locationId: f.locationId,
          locationType: locationType.get(f.locationId) ?? null,
          physicalPositionId: f.physicalPositionId,
          matchStatus: f.match.status,
          productId: f.match.productId,
          brandId: brand?.id ?? f.match.brandId,
          brandRelation: brand?.relation ?? null,
          category: f.match.category,
          needsReview: f.match.status !== 'matched',
        },
        f.match.providerScore,
      );
    }
    for (const p of response.priceLabels) {
      add(
        'price_label',
        p.imageId,
        p.region,
        {
          observationId: p.labelId,
          physicalLabelId: p.physicalLabelId,
          locationId: p.locationId,
          status: p.status,
          unresolvedReason: p.unresolvedReason,
          rawText: p.rawText,
          priceType: p.priceType,
          amountOre: p.amountOre,
          currency: p.currency,
          deposit: p.deposit,
          pack: p.pack,
          multibuy: p.multibuy,
          conditionText: p.conditionText,
          matchStatus: p.match.status,
          productId: p.match.productId,
          brandId: p.match.brandId,
          needsReview: p.status !== 'resolved' || p.match.status !== 'matched',
        },
        p.match.providerScore,
      );
    }
    for (const promo of response.promotions) {
      add(
        'promotion',
        promo.imageId,
        promo.region,
        {
          observationId: promo.promotionId,
          mechanic: promo.mechanic,
          headline: promo.headline,
          conditionText: promo.conditionText,
          productIds: promo.productIds,
          brandIds: promo.brandIds,
          needsReview: false,
        },
        null,
      );
    }
    for (const d of response.displays) {
      add(
        'display',
        d.imageId,
        d.region,
        {
          observationId: d.displayId,
          locationId: d.locationId,
          description: d.description,
          brandIds: d.brandIds,
          needsReview: false,
        },
        null,
      );
    }

    // Corrections reference observations; the newest per target is the effective one.
    const sorted = [...corrections]
      .filter((c) => c.resultId === result.id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const latestByTarget = new Map(sorted.map((c) => [`${c.targetKind}:${c.targetId}`, c.id]));
    for (const c of sorted) {
      const observationIds =
        c.targetKind === 'facing'
          ? response.facings.filter((f) => facingKey(f) === c.targetId).map((f) => f.facingId)
          : response.priceLabels.filter((p) => p.labelId === c.targetId).map((p) => p.labelId);
      const kind: CocoCategoryName = c.targetKind === 'facing' ? 'facing' : 'price_label';
      correctionEntries.push({
        correctionId: c.id,
        visitId: c.visitId,
        resultId: c.resultId,
        targetKind: c.targetKind,
        targetId: c.targetId,
        annotationIds: observationIds
          .map((o) => annotationIdsByObservation.get(`${kind}:${o}`))
          .filter((id): id is number => id !== undefined),
        observationIds,
        value: c.value,
        createdAt: c.createdAt,
        latest: latestByTarget.get(`${c.targetKind}:${c.targetId}`) === c.id,
      });
    }
  }

  stats.images = images.length;
  stats.corrections = correctionEntries.length;
  return {
    coco: {
      info: {
        description: 'Shelfwise draft labels from analysis observations (not human-verified)',
        version: '1.0',
        date_created: createdAt,
      },
      licenses: [
        {
          id: 1,
          name: 'Proprietary — Royal Unibrew field photos; internal model training only',
          url: '',
        },
      ],
      categories: COCO_CATEGORIES,
      images,
      annotations,
    },
    corrections: {
      format: 'shelfwise-corrections',
      version: CORRECTIONS_LAYER_VERSION,
      corrections: correctionEntries,
    },
    stats,
  };
}
