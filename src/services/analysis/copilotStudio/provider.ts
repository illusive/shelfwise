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

/** Short, self-contained instruction sent with every photo (the agent prompt holds the rest). */
export function photoInstruction(request: AnalysisRequest, imageId: string): string {
  const image = request.images.find((i) => i.imageId === imageId);
  return [
    `${PHOTO_RESULT_FORMAT}: analyse this one store photo of beverages in Denmark.`,
    'Reply with ONLY the JSON object described in your instructions, no other text.',
    `Catalogue ${request.catalogueVersion}; use its brandId/productId values, or null.`,
    `Store chain: ${request.store.chain}. Photo ${image?.sequence ?? '?'} of ${request.images.length}.`,
  ].join('\n');
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
  ): Promise<PhotoOutcome> {
    for (let attempt = 0; ; attempt++) {
      try {
        const reply = await withTimeout(
          (s) =>
            transport.analysePhoto(
              {
                image: image.blob,
                imageId: image.imageId,
                instruction: photoInstruction(request, image.imageId),
              },
              s,
            ),
          timeoutMs,
          signal,
        );
        const result = parsePhotoReply(reply);
        if (result || attempt >= retries) return { imageId: image.imageId, result };
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
      const outcomes: PhotoOutcome[] = [];
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
        throw new ProviderError(
          'invalid-response',
          'The analysis agent did not return a usable result for any photo.',
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
