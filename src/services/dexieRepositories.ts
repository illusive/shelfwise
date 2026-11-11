import type { Catalogue } from '@/domain/catalogue';
import type { ShelfwiseDb } from './db';
import type { BlobStore, Repositories } from './repositories';

const CURRENT_REP_KEY = 'currentRepId';

export function createDexieRepositories(db: ShelfwiseDb, catalogue: Catalogue): Repositories {
  return {
    reps: {
      list: () => db.reps.toArray(),
      get: (id) => db.reps.get(id),
    },
    session: {
      async getCurrentRepId() {
        const entry = await db.meta.get(CURRENT_REP_KEY);
        return typeof entry?.value === 'string' ? entry.value : null;
      },
      async setCurrentRepId(id) {
        if (id === null) await db.meta.delete(CURRENT_REP_KEY);
        else await db.meta.put({ key: CURRENT_REP_KEY, value: id });
      },
    },
    stores: {
      list: () => db.stores.toArray(),
      get: (id) => db.stores.get(id),
    },
    catalogue: {
      get: () => catalogue,
    },
    visits: {
      get: (id) => db.visits.get(id),
      async list(filter = {}) {
        let visits = await db.visits.orderBy('createdAt').reverse().toArray();
        if (filter.repId) visits = visits.filter((v) => v.repId === filter.repId);
        if (filter.storeId) visits = visits.filter((v) => v.storeId === filter.storeId);
        return visits;
      },
      async findDraft(storeId, repId) {
        return db.visits.where('[storeId+repId+status]').equals([storeId, repId, 'draft']).first();
      },
      async put(visit) {
        await db.visits.put(visit);
      },
      async update(id, changes) {
        await db.visits.update(id, changes);
      },
      attachJob(visitId, create) {
        return db.transaction('rw', db.visits, db.jobs, async () => {
          const visit = await db.visits.get(visitId);
          if (!visit) throw new Error(`Visit ${visitId} not found`);
          if (visit.jobId) {
            const existing = await db.jobs.get(visit.jobId);
            if (existing) return existing;
          }
          const job = create(visit);
          await db.jobs.put(job);
          await db.visits.update(visitId, {
            jobId: job.id,
            status: 'submitted',
            submittedAt: job.createdAt,
            updatedAt: job.createdAt,
          });
          return job;
        });
      },
      completeJob({ jobId, result, completedAt, updatedAt }) {
        return db.transaction('rw', db.visits, db.jobs, db.results, async () => {
          const job = await db.jobs.get(jobId);
          const visit = await db.visits.get(result.visitId);
          if (!job || job.status === 'cancelled') return false;
          if (!visit || visit.jobId !== jobId || visit.status !== 'submitted') return false;
          await db.results.put(result);
          await db.visits.update(visit.id, {
            status: 'completed',
            resultId: result.id,
            completedAt,
            updatedAt,
          });
          await db.jobs.put({ ...job, status: 'completed', progress: null, updatedAt });
          return true;
        });
      },
      reopen(visitId, idempotencyKey, at) {
        return db.transaction('rw', db.visits, db.jobs, async () => {
          const visit = await db.visits.get(visitId);
          if (!visit || visit.status !== 'submitted') return;
          if (visit.jobId) {
            const job = await db.jobs.get(visit.jobId);
            if (job?.status === 'completed') return;
            if (job) await db.jobs.put({ ...job, status: 'cancelled', updatedAt: at });
          }
          await db.visits.update(visitId, {
            status: 'draft',
            jobId: null,
            submittedAt: null,
            idempotencyKey,
            updatedAt: at,
          });
        });
      },
      async delete(id) {
        await db.transaction('rw', db.visits, db.captures, db.blobs, async () => {
          const captures = await db.captures.where('visitId').equals(id).toArray();
          await db.blobs.bulkDelete(
            captures.flatMap((c) => (c.thumbBlobId ? [c.blobId, c.thumbBlobId] : [c.blobId])),
          );
          await db.captures.bulkDelete(captures.map((c) => c.id));
          await db.visits.delete(id);
        });
      },
    },
    captures: {
      get: (id) => db.captures.get(id),
      async listByVisit(visitId) {
        const captures = await db.captures.where('visitId').equals(visitId).toArray();
        return captures.sort((a, b) => a.sequence - b.sequence);
      },
      async put(capture) {
        await db.captures.put(capture);
      },
      async delete(id) {
        await db.captures.delete(id);
      },
    },
    jobs: {
      get: (id) => db.jobs.get(id),
      listActive: () =>
        db.jobs.where('status').anyOf(['queued', 'preparing', 'analysing']).toArray(),
      async put(job) {
        await db.jobs.put(job);
      },
      update(id, changes) {
        return db.transaction('rw', db.jobs, async () => {
          const current = await db.jobs.get(id);
          if (!current || current.status === 'cancelled') return current;
          const next = { ...current, ...changes };
          await db.jobs.put(next);
          return next;
        });
      },
    },
    results: {
      get: (id) => db.results.get(id),
      async put(result) {
        await db.results.put(result);
      },
    },
    corrections: {
      listByResult: (resultId) => db.corrections.where('resultId').equals(resultId).toArray(),
      async add(correction) {
        await db.corrections.add(correction);
      },
    },
  };
}

export function createDexieBlobStore(db: ShelfwiseDb): BlobStore {
  return {
    async get(id) {
      return (await db.blobs.get(id))?.blob;
    },
    async put(id, blob) {
      await db.blobs.put({ id, blob });
    },
    async delete(id) {
      await db.blobs.delete(id);
    },
  };
}

export function createMemoryBlobStore(): BlobStore {
  const blobs = new Map<string, Blob>();
  return {
    get: async (id) => blobs.get(id),
    put: async (id, blob) => void blobs.set(id, blob),
    delete: async (id) => void blobs.delete(id),
  };
}
