import type { AppConfig } from '@/app/config';
import { indexCatalogue, type CatalogueIndex } from '@/domain/catalogue';
import { createAnalysisService, type AnalysisService } from './analysis/analysisService';
import { createMockProvider } from './analysis/mockProvider';
import { ProviderError, type AnalysisProvider } from './analysis/provider';
import {
  createCopilotStudioProvider,
  type AgentTransport,
} from './analysis/copilotStudio/provider';
import { createSdkTransport } from './analysis/copilotStudio/sdkTransport';
import { copilotStudioReady } from '@/app/config';
import { createCaptureService, type CaptureService } from './captureService';
import { ShelfwiseDb } from './db';
import { createDexieBlobStore, createDexieRepositories } from './dexieRepositories';
import { browserImageProcessor, type ImageProcessor } from './images';
import type { BlobStore, Repositories } from './repositories';
import { seedCatalogue } from './seed/catalogue';
import { ensureSeeded } from './seed';
import { ensureWeekPlanned } from './seed/plans';
import { dateKeyIn } from '@/domain/dates';
import { isRetentionExpired } from '@/domain/dataUse';

export interface Services {
  repos: Repositories;
  blobs: BlobStore;
  catalogue: CatalogueIndex;
  captures: CaptureService;
  analysis: AnalysisService;
}

declare global {
  interface Window {
    /** Test seam (e2e): replaces the Copilot Studio agent with a scripted one. */
    __SHELFWISE_AGENT__?: () => AgentTransport & { retryDelayMs?: number };
  }
}

export interface ProviderDeps {
  /** Delegated token for the agent (signed-in tester); see app/auth.ts. */
  getAgentToken?: () => Promise<string>;
}

export function createProvider(config: AppConfig, deps: ProviderDeps = {}): AnalysisProvider {
  const catalogue = indexCatalogue(seedCatalogue);
  const stub = typeof window !== 'undefined' ? window.__SHELFWISE_AGENT__?.() : undefined;
  if (stub) {
    // Scripted errors arrive as plain `{ code, message, retryable }` objects.
    const transport: AgentTransport = {
      model: stub.model,
      analysePhoto: (input, signal) =>
        stub.analysePhoto(input, signal).catch((e: unknown) => {
          const err = e as Partial<ProviderError> | null;
          if (err && typeof err.code === 'string')
            throw new ProviderError(err.code, err.message ?? err.code, err.retryable ?? true);
          throw e;
        }),
    };
    return createCopilotStudioProvider({
      transport,
      catalogue,
      retryDelayMs: stub.retryDelayMs ?? 4_000,
    });
  }
  if (config.analysisProvider === 'copilot-studio') {
    if (copilotStudioReady(config.copilotStudio) && deps.getAgentToken) {
      return createCopilotStudioProvider({
        transport: createSdkTransport({
          config: config.copilotStudio,
          getToken: deps.getAgentToken,
        }),
        catalogue,
      });
    }
    console.warn('Copilot Studio is not fully configured; falling back to the mock provider.');
  }
  return createMockProvider({
    catalogue: seedCatalogue,
    latencyMs: config.mockLatencyMs,
    failFirstAttempt: config.mockFailFirstAttempt,
  });
}

export async function createServices(
  config: AppConfig,
  options: {
    db?: ShelfwiseDb;
    images?: ImageProcessor;
    provider?: AnalysisProvider;
    providerDeps?: ProviderDeps;
  } = {},
): Promise<Services> {
  const db = options.db ?? new ShelfwiseDb();
  await ensureSeeded(db);
  await sweepOrphanBlobs(db);
  await applyRetention(db, new Date());
  await ensureWeekPlanned(db, dateKeyIn(new Date().toISOString()));
  const repos = createDexieRepositories(db, seedCatalogue);
  const blobs = createDexieBlobStore(db);
  const provider = options.provider ?? createProvider(config, options.providerDeps);
  const captures = createCaptureService({
    repos,
    blobs,
    images: options.images ?? browserImageProcessor,
    retentionDays: config.retentionDays,
  });
  return {
    repos,
    blobs,
    catalogue: indexCatalogue(seedCatalogue),
    captures,
    analysis: createAnalysisService({
      repos,
      blobs,
      provider,
      beforeSubmit: async (visitId) => {
        await captures.whenIdle(visitId);
        await captures.recordDataUse(visitId);
      },
    }),
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

/**
 * Local retention, deliberately conservative: for analysed visits past `retainUntil`, replace
 * each full-resolution original with its thumbnail so history, metrics and evidence still work.
 * Drafts and in-flight submissions are never touched. Real retention is enforced server-side.
 */
export async function applyRetention(db: ShelfwiseDb, now: Date): Promise<number> {
  const expired = (await db.visits.where('status').equals('completed').toArray()).filter((v) =>
    isRetentionExpired(v, now),
  );
  let purged = 0;
  for (const visit of expired) {
    const captures = await db.captures.where('visitId').equals(visit.id).toArray();
    for (const capture of captures) {
      if (
        capture.originalPurgedAt ||
        !capture.thumbBlobId ||
        capture.blobId === capture.thumbBlobId
      )
        continue;
      await db.transaction('rw', db.captures, db.blobs, async () => {
        await db.blobs.delete(capture.blobId);
        await db.captures.update(capture.id, {
          blobId: capture.thumbBlobId!,
          originalPurgedAt: now.toISOString(),
        });
      });
      purged += 1;
    }
  }
  return purged;
}
