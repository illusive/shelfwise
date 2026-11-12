import { z } from 'zod';
import { CATEGORIES } from '@/domain/categories';
import { imageIssueSchema, locationTypeSchema } from './analysis';

/**
 * Per-photo reply from the Copilot Studio agent (docs/copilot-studio-agent.md). The agent
 * sees one photo at a time and answers in this small, LLM-friendly shape; Shelfwise maps it
 * into the full `AnalysisResponse` (our ids, øre, reconciliation) and validates that.
 *
 * Parsing is lenient on purpose: an invalid field becomes "unknown"/empty rather than
 * failing the whole photo, and nothing the model says is trusted without mapping.
 */
export const PHOTO_RESULT_FORMAT = 'shelfwise-photo-v1';

/** `[x, y, width, height]`, 0–1 of the photo from the top-left corner. */
const box = z.array(z.number()).length(4).nullable().catch(null);
const idOrNull = z.string().trim().min(1).nullable().catch(null);
const textOrNull = z.string().trim().nullable().catch(null);
const dkkOrNull = z.number().nonnegative().nullable().catch(null);
const idList = z.array(z.string().trim().min(1)).catch([]);

const facingGroupSchema = z.object({
  status: z.enum(['matched', 'candidate', 'unknown']).catch('unknown'),
  brandId: idOrNull,
  productId: idOrNull,
  category: z.enum(CATEGORIES).nullable().catch(null),
  /** Model's own confidence, not a measured accuracy. */
  score: z.number().min(0).max(1).nullable().catch(null),
  /** Adjacent identical facings reported as one group (box spans all of them). */
  count: z.number().int().min(1).max(60).catch(1),
  box,
});

const priceLabelSchema = z.object({
  status: z.enum(['resolved', 'unresolved']).catch('unresolved'),
  unresolvedReason: z
    .enum(['unreadable', 'ambiguous-product', 'ambiguous-condition', 'partially-visible'])
    .nullable()
    .catch(null),
  rawText: textOrNull,
  brandId: idOrNull,
  productId: idOrNull,
  priceType: z.enum(['regular', 'promotion', 'member', 'unknown']).catch('unknown'),
  priceDkk: dkkOrNull,
  deposit: z
    .object({
      shown: z.boolean().catch(false),
      dkk: dkkOrNull,
      included: z.boolean().nullable().catch(null),
    })
    .catch({ shown: false, dkk: null, included: null }),
  pack: z
    .object({
      units: z.number().int().positive().nullable().catch(null),
      volumeMl: z.number().positive().nullable().catch(null),
    })
    .catch({ units: null, volumeMl: null }),
  multibuy: z
    .object({ quantity: z.number().int().min(2), totalDkk: z.number().nonnegative() })
    .nullable()
    .catch(null),
  conditionText: textOrNull,
  box,
});

const promotionSchema = z.object({
  mechanic: z.enum(['multibuy', 'price-cut', 'member-price', 'bundle', 'other']).catch('other'),
  headline: z.string().trim().catch(''),
  conditionText: textOrNull,
  productIds: idList,
  brandIds: idList,
  box,
});

const displaySchema = z.object({
  description: z.string().trim().catch(''),
  brandIds: idList,
  box,
});

const list = <T extends z.ZodTypeAny>(item: T) =>
  z
    .array(z.unknown())
    .catch([])
    .transform((items) =>
      items.flatMap((i) => {
        const parsed = item.safeParse(i);
        return parsed.success ? [parsed.data as z.infer<T>] : [];
      }),
    );

export const photoResultSchema = z.object({
  format: z.literal(PHOTO_RESULT_FORMAT).optional().catch(undefined),
  usable: z.boolean().catch(true),
  locationType: locationTypeSchema.nullable().catch(null),
  issues: z
    .array(z.unknown())
    .catch([])
    .transform((items) =>
      items.flatMap((i) => {
        const parsed = imageIssueSchema.safeParse(i);
        return parsed.success ? [parsed.data] : [];
      }),
    ),
  facings: list(facingGroupSchema),
  priceLabels: list(priceLabelSchema),
  promotions: list(promotionSchema),
  displays: list(displaySchema),
});

export type PhotoResult = z.infer<typeof photoResultSchema>;
export type PhotoFacingGroup = z.infer<typeof facingGroupSchema>;
export type PhotoPriceLabel = z.infer<typeof priceLabelSchema>;

/**
 * Finds the JSON object in an agent reply: a structured `value`, a fenced ```json block, or
 * the outermost `{…}` in the text. Returns null when there is none.
 */
export function extractJson(reply: { text?: string | null; value?: unknown }): unknown {
  if (reply.value && typeof reply.value === 'object') return reply.value;
  const text = reply.text?.trim();
  if (!text) return null;
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const candidates = [fenced?.[1], text];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start < 0 || end <= start) continue;
    try {
      return JSON.parse(candidate.slice(start, end + 1));
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

/** Parses an agent reply into a photo result; null if it holds no usable JSON object. */
export function parsePhotoReply(reply: { text?: string | null; value?: unknown }) {
  const json = extractJson(reply);
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null;
  const parsed = photoResultSchema.safeParse(json);
  return parsed.success ? parsed.data : null;
}
