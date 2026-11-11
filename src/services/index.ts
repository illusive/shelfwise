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
import { ensureWeekPlanned } from './seed/plans';
import { dateKeyIn } from '@/domain/dates';

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
  await sweepOrphanBlobs(db);
  await ensureWeekPlanned(db, dateKeyIn(new Date().toISOString()));
  const repos = createDexieRepositories(db, seedCatalogue);
  const blobs = createDexieBlobStore(db);
  const provider = options.provider ?? createProvider(config);
  const captures = createCaptureService({
    repos,
    blobs,
    images: options.images ?? browserImageProcessor,
  });
  return {
    repos,
    blobs,
    catalogue: indexCatalogue(seedCatalogue),
    captures,
    analysis: createAnalysisService({ repos, blobs, provider, beforeSubmit: captures.whenIdle }),
  };
}

/** Deletes image blobs no capture references (e.g. a removal whose undo window was cut short). */
export async function sweepOrphanBlobs(db: ShelfwiseDb): Promise<number> {
  const captures = await db.captures.toArray();
  const referenced = new Set(captures.flatMap((c) => [c.blobId, c.thumbBlobId ?? '']));
  const keys = await db.blobs.toCollection().primaryKeys();
  const orphans = keys.filter((key) => !referenced.has(key));
  await db.blobs.bulkDelete(orphans);
  return orphans.length;
}
