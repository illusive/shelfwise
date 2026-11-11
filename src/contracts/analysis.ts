import { z } from 'zod';
import { CATEGORIES } from '@/domain/categories';

/**
 * Provider-agnostic analysis contract. Every provider response is validated against
 * `analysisResponseSchema` before it is stored; metrics are then derived deterministically
 * in `src/domain`. See docs/analysis-contract.md.
 */
export const ANALYSIS_SCHEMA_VERSION = '1.0.0' as const;

const id = z.string().min(1);
const ore = z.number().int().nonnegative();

export const locationTypeSchema = z.enum(['shelf', 'cooler', 'display']);
export type LocationType = z.infer<typeof locationTypeSchema>;

export const categorySchema = z.enum(CATEGORIES);

/** Normalised to the image: 0..1 from the top-left corner. */
export const regionSchema = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().gt(0).max(1),
    height: z.number().gt(0).max(1),
  })
  .refine((r) => r.x + r.width <= 1.0001 && r.y + r.height <= 1.0001, {
    message: 'Region exceeds image bounds',
  });
export type Region = z.infer<typeof regionSchema>;

/**
 * `matched`: provider asserts the product/brand. `candidate`: a plausible but unconfirmed
 * match. `unknown`: beverage present but not identified. `providerScore` is the provider's own
 * score, never a validated accuracy.
 */
export const matchSchema = z
  .object({
    status: z.enum(['matched', 'candidate', 'unknown']),
    productId: id.nullable(),
    brandId: id.nullable(),
    category: categorySchema.nullable(),
    providerScore: z.number().min(0).max(1).nullable(),
  })
  .refine((m) => m.status === 'unknown' || m.productId !== null || m.brandId !== null, {
    message: 'Matched and candidate observations need a productId or brandId',
  });
export type ProductMatch = z.infer<typeof matchSchema>;

export const imageIssueSchema = z.enum([
  'blurry',
  'glare',
  'reflection',
  'too-dark',
  'obstructed',
  'low-resolution',
  'not-a-shelf',
]);
export type ImageIssue = z.infer<typeof imageIssueSchema>;

export const imageAnalysisSchema = z.object({
  imageId: id,
  usable: z.boolean(),
  locationType: locationTypeSchema.nullable(),
  locationId: id.nullable(),
  issues: z.array(imageIssueSchema),
});

export const locationSchema = z.object({
  locationId: id,
  type: locationTypeSchema,
  label: z.string(),
  imageIds: z.array(id).min(1),
});
export type AnalysisLocation = z.infer<typeof locationSchema>;

/**
 * One visible front-facing product position seen in one image. Observations of the same
 * physical position in overlapping photos share `physicalPositionId`; `null` means the
 * provider could not reconcile it.
 */
export const facingSchema = z.object({
  facingId: id,
  imageId: id,
  locationId: id,
  physicalPositionId: id.nullable(),
  region: regionSchema.nullable(),
  match: matchSchema,
});
export type FacingObservation = z.infer<typeof facingSchema>;

export const priceLabelSchema = z.object({
  labelId: id,
  imageId: id,
  locationId: id.nullable(),
  /** Same physical label seen in overlapping photos shares this id. */
  physicalLabelId: id.nullable(),
  region: regionSchema.nullable(),
  rawText: z.string().nullable(),
  status: z.enum(['resolved', 'unresolved']),
  unresolvedReason: z
    .enum(['unreadable', 'ambiguous-product', 'ambiguous-condition', 'partially-visible'])
    .nullable(),
  match: matchSchema,
  priceType: z.enum(['regular', 'promotion', 'member', 'unknown']),
  /** Price as displayed for the labelled pack, in øre. */
  amountOre: ore.nullable(),
  currency: z.literal('DKK'),
  deposit: z.object({
    shown: z.boolean(),
    amountOre: ore.nullable(),
    /** true: displayed price includes pant; false: pant is added on top; null: not stated. */
    included: z.boolean().nullable(),
  }),
  pack: z.object({
    units: z.number().int().positive().nullable(),
    volumeMl: z.number().positive().nullable(),
  }),
  multibuy: z.object({ quantity: z.number().int().min(2), totalOre: ore }).nullable(),
  conditionText: z.string().nullable(),
  promotionId: id.nullable(),
});
export type PriceLabelObservation = z.infer<typeof priceLabelSchema>;

export const promotionSchema = z.object({
  promotionId: id,
  imageId: id,
  region: regionSchema.nullable(),
  mechanic: z.enum(['multibuy', 'price-cut', 'member-price', 'bundle', 'other']),
  headline: z.string(),
  conditionText: z.string().nullable(),
  productIds: z.array(id),
  brandIds: z.array(id),
});
export type PromotionObservation = z.infer<typeof promotionSchema>;

export const displaySchema = z.object({
  displayId: id,
  imageId: id,
  locationId: id,
  region: regionSchema.nullable(),
  brandIds: z.array(id),
  description: z.string(),
});
export type DisplayObservation = z.infer<typeof displaySchema>;

export const warningCodeSchema = z.enum([
  'overlap-unreconciled',
  'reflection',
  'low-coverage',
  'unusable-image',
  'classification-uncertain',
  'label-unreadable',
]);
export type WarningCode = z.infer<typeof warningCodeSchema>;

export const warningSchema = z.object({
  code: warningCodeSchema,
  message: z.string(),
  imageIds: z.array(id),
});
export type AnalysisWarning = z.infer<typeof warningSchema>;

export const failureSchema = z.object({
  code: z.string().min(1),
  message: z.string(),
  retryable: z.boolean(),
});

export const analysisResponseSchema = z
  .object({
    schemaVersion: z.literal(ANALYSIS_SCHEMA_VERSION),
    jobId: id,
    visitId: id,
    status: z.enum(['completed', 'partial', 'failed']),
    source: z.enum(['mock', 'live']),
    provider: z.object({ name: z.string().min(1), model: z.string().nullable() }),
    methodVersion: z.string().min(1),
    catalogueVersion: z.string().min(1),
    analysedAt: z.string().datetime({ offset: true }),
    images: z.array(imageAnalysisSchema),
    locations: z.array(locationSchema),
    facings: z.array(facingSchema),
    priceLabels: z.array(priceLabelSchema),
    promotions: z.array(promotionSchema),
    displays: z.array(displaySchema),
    warnings: z.array(warningSchema),
    failure: failureSchema.nullable(),
    narrative: z.string().nullable(),
  })
  .superRefine((res, ctx) => {
    const imageIds = new Set(res.images.map((i) => i.imageId));
    const locationIds = new Set(res.locations.map((l) => l.locationId));
    const check = (ok: boolean, path: (string | number)[], message: string) => {
      if (!ok) ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
    };
    if (res.status === 'failed') check(res.failure !== null, ['failure'], 'Failed needs failure');
    res.locations.forEach((l, i) =>
      l.imageIds.forEach((imageId) =>
        check(imageIds.has(imageId), ['locations', i], `Unknown image ${imageId}`),
      ),
    );
    res.facings.forEach((f, i) => {
      check(imageIds.has(f.imageId), ['facings', i, 'imageId'], 'Unknown image');
      check(locationIds.has(f.locationId), ['facings', i, 'locationId'], 'Unknown location');
    });
    res.priceLabels.forEach((p, i) => {
      check(imageIds.has(p.imageId), ['priceLabels', i, 'imageId'], 'Unknown image');
      check(
        p.locationId === null || locationIds.has(p.locationId),
        ['priceLabels', i, 'locationId'],
        'Unknown location',
      );
      check(
        p.status === 'resolved' || p.unresolvedReason !== null,
        ['priceLabels', i, 'unresolvedReason'],
        'Unresolved labels need a reason',
      );
    });
    res.displays.forEach((d, i) => {
      check(locationIds.has(d.locationId), ['displays', i, 'locationId'], 'Unknown location');
    });
  });
export type AnalysisResponse = z.infer<typeof analysisResponseSchema>;

export const analysisRequestSchema = z.object({
  schemaVersion: z.literal(ANALYSIS_SCHEMA_VERSION),
  jobId: id,
  visitId: id,
  idempotencyKey: id,
  store: z.object({ storeId: id, chain: z.string(), countryCode: z.literal('DK') }),
  catalogueVersion: z.string().min(1),
  methodVersion: z.string().min(1),
  /** Data-use terms the server must honour (training use, retention); null for older visits. */
  dataUse: z
    .object({
      trainingConsent: z.boolean(),
      retainUntil: z.string().datetime({ offset: true }),
    })
    .nullable()
    .optional(),
  images: z
    .array(
      z.object({
        imageId: id,
        sequence: z.number().int().positive(),
        capturedAt: z.string().datetime({ offset: true }),
        mimeType: z.string(),
        width: z.number().int().positive(),
        height: z.number().int().positive(),
        byteSize: z.number().int().nonnegative(),
        /** Overlap-guide estimate from the camera; null/absent for imports. Guidance only. */
        placement: z
          .object({
            run: z.number().int().positive(),
            position: z.number().int().positive(),
            overlap: z.number().min(0).max(1).nullable(),
            confidence: z.number().min(0).max(1).nullable(),
            rollDeg: z.number().nullable(),
          })
          .nullable()
          .optional(),
      }),
    )
    .min(1),
});
export type AnalysisRequest = z.infer<typeof analysisRequestSchema>;
