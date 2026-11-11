import type { AnalysisRequest } from '@/contracts/analysis';

export interface AnalysisInput {
  request: AnalysisRequest;
  images: { imageId: string; blob: Blob }[];
}

/**
 * Provider boundary. Implementations return raw provider output; the analysis service
 * validates it against the contract before anything is stored.
 *
 * A live provider must call a server-side endpoint: credentials and privileged calls never
 * live in the browser.
 */
export interface AnalysisProvider {
  readonly id: string;
  readonly source: 'mock' | 'live';
  analyse(input: AnalysisInput, signal?: AbortSignal): Promise<unknown>;
}
