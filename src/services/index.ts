import type { AppConfig } from '@/app/config';
import { indexCatalogue, type CatalogueIndex } from '@/domain/catalogue';
import { createAnalysisService, type AnalysisService } from './analysis/analysisService';
import { createMockProvider } from './analysis/mockProvider';
import type { AnalysisProvider } from './analysis/provider';
import { createCaptureService, type CaptureService } from './captureService';
import { ShelfwiseDb } from './db';
import { createDexieBlobStore, createDexieRepositories } from './dexieRepositories';
import { browserImageProcessor, type ImageProcessor } from './images';
import type { BlobStore, Repositories } from './repositories';
import { seedCatalogue } from './seed/catalogue';
import { ensureSeeded } from './seed';

export interface Services {
  repos: Repositories;
  blobs: BlobStore;
  catalogue: CatalogueIndex;
  captures: CaptureService;
  analysis: AnalysisService;
}

export function createProvider(config: AppConfig): AnalysisProvider {
  if (config.analysisProvider === 'live') {
    // The live adapter needs a server-side endpoint (credentials must not reach the browser).
    console.warn('Live analysis is not available yet; falling back to the mock provider.');
  }
  return createMockProvider({
    catalogue: seedCatalogue,
    latencyMs: config.mockLatencyMs,
    failFirstAttempt: config.mockFailFirstAttempt,
  });
}

export async function createServices(
  config: AppConfig,
  options: { db?: ShelfwiseDb; images?: ImageProcessor; provider?: AnalysisProvider } = {},
): Promise<Services> {
  const db = options.db ?? new ShelfwiseDb();
  await ensureSeeded(db);
  const repos = createDexieRepositories(db, seedCatalogue);
  const blobs = createDexieBlobStore(db);
  const provider = options.provider ?? createProvider(config);
  return {
    repos,
    blobs,
    catalogue: indexCatalogue(seedCatalogue),
    captures: createCaptureService({ repos, blobs, images: options.images ?? browserImageProcessor }),
    analysis: createAnalysisService({ repos, blobs, provider }),
  };
}
