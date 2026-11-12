import type { AnalysisRequest } from '@/contracts/analysis';

/** A provider failure the analysis service records as a job failure with this code. */
export class ProviderError extends Error {
  constructor(
    readonly code:
      'sign-in-required' | 'provider-throttled' | 'provider-unavailable' | 'invalid-response',
    message: string,
    readonly retryable = true,
  ) {
    super(message);
  }
}

export interface AnalysisInput {
  request: AnalysisRequest;
  images: { imageId: string; blob: Blob }[];
  /** Live providers report photos analysed so far. */
  onProgress?: (done: number, total: number) => void;
}

/**
 * Provider boundary. Implementations return raw provider output; the analysis service
 * validates it against the contract before anything is stored.
 *
 * Never put secrets in the browser: a live provider either calls a server-side endpoint or,
 * like Copilot Studio, uses the signed-in user's own token (no shared credentials).
 */
export interface AnalysisProvider {
  readonly id: string;
  readonly source: 'mock' | 'live';
  analyse(input: AnalysisInput, signal?: AbortSignal): Promise<unknown>;
}
