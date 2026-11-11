import {
  ANALYSIS_SCHEMA_VERSION,
  analysisRequestSchema,
  analysisResponseSchema,
  type AnalysisRequest,
} from '@/contracts/analysis';
import type { AnalysisJob, JobFailure } from '@/domain/models';
import { SOS_METHOD_VERSION } from '@/domain/sos';
import { newId, nowIso } from '../ids';
import type { BlobStore, Repositories } from '../repositories';
import type { AnalysisProvider } from './provider';

class JobError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

export type AnalysisService = ReturnType<typeof createAnalysisService>;

export function createAnalysisService(deps: {
  repos: Repositories;
  blobs: BlobStore;
  provider: AnalysisProvider;
  now?: () => Date;
}) {
  const { repos, blobs, provider } = deps;
  const now = deps.now ?? (() => new Date());
  const running = new Map<string, Promise<void>>();

  async function save(job: AnalysisJob, changes: Partial<AnalysisJob>): Promise<AnalysisJob> {
    const next = { ...job, ...changes, updatedAt: nowIso(now) };
    await repos.jobs.put(next);
    return next;
  }

  async function isCancelled(jobId: string) {
    return (await repos.jobs.get(jobId))?.status === 'cancelled';
  }

  async function runJob(jobId: string): Promise<void> {
    let job = await repos.jobs.get(jobId);
    if (!job || job.status === 'completed' || job.status === 'cancelled') return;
    const visit = await repos.visits.get(job.visitId);
    const store = visit ? await repos.stores.get(visit.storeId) : undefined;
    if (!visit || !store) {
      await save(job, {
        status: 'failed',
        failure: { code: 'visit-missing', message: 'Visit not found.', retryable: false },
      });
      return;
    }

    const captures = await repos.captures.listByVisit(visit.id);
    job = await save(job, {
      status: 'preparing',
      attempts: job.attempts + 1,
      failure: null,
      progress: { done: 0, total: captures.length },
    });

    try {
      if (captures.length === 0) throw new JobError('no-photos', 'The visit has no photos.', false);
      const images: { imageId: string; blob: Blob }[] = [];
      for (const capture of captures) {
        const blob = await blobs.get(capture.blobId);
        if (!blob)
          throw new JobError('photo-missing', 'A photo is missing from this device.', false);
        images.push({ imageId: capture.id, blob });
        job = await save(job, { progress: { done: images.length, total: captures.length } });
      }

      const request: AnalysisRequest = analysisRequestSchema.parse({
        schemaVersion: ANALYSIS_SCHEMA_VERSION,
        jobId: job.id,
        visitId: visit.id,
        idempotencyKey: job.idempotencyKey,
        store: { storeId: store.id, chain: store.chain, countryCode: 'DK' },
        catalogueVersion: repos.catalogue.get().version,
        methodVersion: SOS_METHOD_VERSION,
        images: captures.map((c) => ({
          imageId: c.id,
          sequence: c.sequence,
          capturedAt: c.capturedAt,
          mimeType: c.mimeType,
          width: c.width,
          height: c.height,
          byteSize: c.byteSize,
        })),
      });

      job = await save(job, { status: 'analysing', progress: null });
      let raw: unknown;
      try {
        raw = await provider.analyse({ request, images });
      } catch (error) {
        throw new JobError('provider-error', errorMessage(error), true);
      }

      const parsed = analysisResponseSchema.safeParse(raw);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        throw new JobError(
          'invalid-response',
          `The analysis response was invalid (${issue?.path.join('.') ?? 'unknown'}: ${issue?.message ?? ''}).`,
          true,
        );
      }
      const response = parsed.data;
      if (response.jobId !== job.id || response.visitId !== visit.id) {
        throw new JobError('mismatched-response', 'The response belongs to another job.', true);
      }
      if (response.status === 'failed') {
        const failure = response.failure!;
        throw new JobError(failure.code, failure.message, failure.retryable);
      }
      if (await isCancelled(job.id)) return;

      // Deterministic id: a retried job overwrites, never duplicates, its result.
      const resultId = `result-${job.id}`;
      await repos.results.put({
        id: resultId,
        visitId: visit.id,
        jobId: job.id,
        storedAt: nowIso(now),
        response,
      });
      await repos.visits.update(visit.id, {
        status: 'completed',
        resultId,
        completedAt: response.analysedAt,
        updatedAt: nowIso(now),
      });
      await save(job, { status: 'completed', progress: null });
    } catch (error) {
      if (await isCancelled(job.id)) return;
      const failure: JobFailure =
        error instanceof JobError
          ? { code: error.code, message: error.message, retryable: error.retryable }
          : { code: 'unexpected', message: errorMessage(error), retryable: true };
      await save(job, { status: 'failed', failure, progress: null });
    }
  }

  function ensureRunning(jobId: string): Promise<void> {
    const existing = running.get(jobId);
    if (existing) return existing;
    const run = runJob(jobId).finally(() => running.delete(jobId));
    running.set(jobId, run);
    return run;
  }

  return {
    providerSource: provider.source,

    /** Idempotent: returns the visit's existing job if it was already submitted. */
    async submitVisit(visitId: string): Promise<AnalysisJob> {
      const captures = await repos.captures.listByVisit(visitId);
      if (captures.length === 0) throw new Error('Add at least one photo before analysing.');
      const job = await repos.visits.attachJob(visitId, (visit) => {
        const at = nowIso(now);
        return {
          id: newId('job'),
          visitId,
          idempotencyKey: visit.idempotencyKey,
          providerId: provider.id,
          status: 'queued',
          attempts: 0,
          progress: null,
          failure: null,
          createdAt: at,
          updatedAt: at,
        };
      });
      if (job.status === 'queued') void ensureRunning(job.id);
      return job;
    },

    async retry(jobId: string): Promise<void> {
      const job = await repos.jobs.get(jobId);
      if (!job || job.status !== 'failed' || !job.failure?.retryable) return;
      await save(job, { status: 'queued' });
      await ensureRunning(jobId);
    },

    /** Restarts jobs interrupted by a reload or closed tab. */
    async resumeInterrupted(): Promise<void> {
      const active = await repos.jobs.listActive();
      active.forEach((job) => void ensureRunning(job.id));
    },

    /** Resolves when the job's current run finishes (for tests and demos). */
    whenIdle(jobId: string): Promise<void> {
      return running.get(jobId) ?? Promise.resolve();
    },
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}
