import { parsePhotoReply, PHOTO_RESULT_FORMAT } from '@/contracts/agentPhoto';
import type { AnalysisRequest } from '@/contracts/analysis';
import type { CatalogueIndex } from '@/domain/catalogue';
import { ProviderError, type AnalysisProvider } from '../provider';
import { buildResponse, COPILOT_STUDIO_PROVIDER_ID, type PhotoOutcome } from './buildResponse';

export { ProviderError };

export interface AgentReply {
  text: string | null;
  /** Structured payload, if the agent sent one (event/message `value`). */
  value: unknown;
  /** Every agent message in the turn (oldest first), when the agent split its answer. */
  all?: { text: string | null; value: unknown }[];
}

/** Sends one photo + instruction to the agent in a fresh conversation and returns its reply. */
export interface AgentTransport {
  readonly model: string | null;
  analysePhoto(
    input: { image: Blob; instruction: string; imageId: string },
    signal?: AbortSignal,
  ): Promise<AgentReply>;
}

export interface CopilotStudioProviderOptions {
  transport: AgentTransport;
  catalogue: CatalogueIndex;
  /** Photos in flight at once (agent quotas are per minute; keep this low). */
  concurrency?: number;
  timeoutMs?: number;
  /** Extra attempts for a throttled or unreadable photo. */
  retries?: number;
  retryDelayMs?: number;
  /** Reports finished photos (for progress). */
  onPhoto?: (done: number, total: number) => void;
  now?: () => Date;
}

/**
 * Self-contained instruction sent with every photo: format, rules and catalogue ids, so the
 * agent can answer correctly even if its own prompt doesn't describe the format.
 */
export function photoInstruction(
  request: AnalysisRequest,
  imageId: string,
  catalogue?: CatalogueIndex,
): string {
  const image = request.images.find((i) => i.imageId === imageId);
  const ids = catalogue
    ? [
        `brandId values: ${catalogue.brands.map((b) => b.id).join(', ')}`,
        `productId values: ${catalogue.products.map((p) => p.id).join(', ')}`,
      ]
    : [];
  return [
    `${PHOTO_RESULT_FORMAT}: analyse the attached photo of beverages in a Danish store (${request.store.chain}; photo ${image?.sequence ?? '?'} of ${request.images.length}).`,
    'Reply with ONLY one JSON object, no other text, in exactly this shape:',
    PHOTO_FORMAT_SKELETON,
    'Rules: list every front-row beverage left to right; group identical neighbours with "count". box = [x, y, width, height] as fractions 0-1 of the photo from the top-left, or null. Use only the ids below, or null if unsure; status "candidate" if unsure, "unknown" if you cannot tell. Prices in DKK as shown; pant separately in deposit; never guess an unreadable price (status "unresolved", priceDkk null). If the photo is not a beverage shelf/cooler/display, set usable false with issues.',
    `locationType: shelf | cooler | display. issues: blurry, glare, reflection, too-dark, obstructed, low-resolution, not-a-shelf. category: beer, soft-drinks, water, energy-functional, rtd-cider, other.`,
    ...ids,
  ].join('\n');
}

/** Compact example of the reply shape (full spec: docs/copilot-studio-agent.md). */
export const PHOTO_FORMAT_SKELETON = JSON.stringify({
  format: PHOTO_RESULT_FORMAT,
  usable: true,
  locationType: 'cooler',
  issues: [],
  facings: [
    {
      status: 'matched',
      brandId: 'faxe-kondi',
      productId: 'faxe-kondi-330',
      category: 'soft-drinks',
      score: 0.8,
      count: 3,
      box: [0.05, 0.1, 0.3, 0.2],
    },
  ],
  priceLabels: [
    {
      status: 'resolved',
      unresolvedReason: null,
      rawText: '2 STK 30,-',
      brandId: 'faxe-kondi',
      productId: 'faxe-kondi-330',
      priceType: 'promotion',
      priceDkk: 17.95,
      deposit: { shown: true, dkk: 1.5, included: false },
      pack: { units: 1, volumeMl: 330 },
      multibuy: { quantity: 2, totalDkk: 30 },
      conditionText: null,
      box: [0.08, 0.31, 0.1, 0.04],
    },
  ],
  promotions: [],
  displays: [],
});

/** Parses a reply, trying the newest agent message first, then all text together. */
export function parseAgentReply(reply: AgentReply) {
  const candidates = [reply, ...[...(reply.all ?? [])].reverse()];
  for (const c of candidates) {
    const result = parsePhotoReply(c);
    if (result) return result;
  }
  const joined = (reply.all ?? []).map((a) => a.text ?? '').join('\n');
  return joined ? parsePhotoReply({ text: joined }) : null;
}

/** Short excerpt of what the agent said, for diagnostics (no photo data). */
export function replyExcerpt(reply: AgentReply | null, max = 240): string {
  if (!reply) return '(no reply)';
  const text = (reply.all?.length ? reply.all.map((a) => a.text ?? '').join(' | ') : reply.text)
    ?.replace(/\s+/g, ' ')
    .trim();
  if (!text) return reply.value ? JSON.stringify(reply.value).slice(0, max) : '(empty reply)';
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });

async function withTimeout<T>(
  run: (signal: AbortSignal) => Promise<T>,
  ms: number,
  outer?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  outer?.addEventListener('abort', abort);
  const timer = setTimeout(abort, ms);
  try {
    return await run(controller.signal);
  } catch (error) {
    if (controller.signal.aborted && !outer?.aborted) {
      throw new ProviderError('provider-unavailable', 'The analysis agent did not answer in time.');
    }
    throw error;
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener('abort', abort);
  }
}

/**
 * Live analysis through a Copilot Studio agent: one conversation per photo (uploaded files
 * accumulate in a conversation's context), a few photos at a time, each reply parsed and mapped
 * into the shared contract. Photos whose replies stay unusable are reported as unusable images;
 * the job fails only if no photo could be analysed or the rep must sign in.
 */
export function createCopilotStudioProvider(
  options: CopilotStudioProviderOptions,
): AnalysisProvider {
  const {
    transport,
    catalogue,
    concurrency = 2,
    timeoutMs = 120_000,
    retries = 2,
    retryDelayMs = 4_000,
  } = options;
  const now = options.now ?? (() => new Date());

  async function analyseOne(
    request: AnalysisRequest,
    image: { imageId: string; blob: Blob },
    signal?: AbortSignal,
  ): Promise<PhotoOutcome & { excerpt: string | null }> {
    let excerpt: string | null = null;
    for (let attempt = 0; ; attempt++) {
      try {
        const reply = await withTimeout(
          (s) =>
            transport.analysePhoto(
              {
                image: image.blob,
                imageId: image.imageId,
                instruction: photoInstruction(request, image.imageId, catalogue),
              },
              s,
            ),
          timeoutMs,
          signal,
        );
        const result = parseAgentReply(reply);
        if (!result) {
          excerpt = replyExcerpt(reply);
          console.warn(`Copilot Studio: unreadable reply for ${image.imageId}: ${excerpt}`);
        }
        if (result || attempt >= retries) return { imageId: image.imageId, result, excerpt };
      } catch (error) {
        const retryable =
          error instanceof ProviderError &&
          (error.code === 'provider-throttled' || error.code === 'provider-unavailable');
        if (!retryable || attempt >= retries) throw error;
      }
      await wait(retryDelayMs * 2 ** attempt, signal);
    }
  }

  return {
    id: COPILOT_STUDIO_PROVIDER_ID,
    source: 'live',
    async analyse({ request, images, onProgress }, signal) {
      const outcomes: (PhotoOutcome & { excerpt: string | null })[] = [];
      let next = 0;
      let done = 0;
      const worker = async () => {
        while (next < images.length) {
          const image = images[next++];
          outcomes.push(await analyseOne(request, image, signal));
          done += 1;
          options.onPhoto?.(done, images.length);
          onProgress?.(done, images.length);
        }
      };
      await Promise.all(Array.from({ length: Math.min(concurrency, images.length) }, worker));
      // Unusable photos are a valid answer; replies we couldn't read at all are not.
      if (!outcomes.some((o) => o.result)) {
        const said = outcomes.find((o) => o.excerpt)?.excerpt ?? '(no reply)';
        throw new ProviderError(
          'invalid-response',
          `The analysis agent did not reply in the shelfwise-photo-v1 JSON format. It replied: "${said}"`,
        );
      }
      return buildResponse({
        request,
        photos: outcomes,
        catalogue,
        analysedAt: now().toISOString(),
        model: transport.model,
      });
    },
  };
}
