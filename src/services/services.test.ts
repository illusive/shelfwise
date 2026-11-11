import { beforeEach, describe, expect, it } from 'vitest';
import { analysisResponseSchema } from '@/contracts/analysis';
import { indexCatalogue } from '@/domain/catalogue';
import { computeVisitMetrics } from '@/domain/metrics';
import { generateMockAnalysis } from './analysis/mockProvider';
import type { AnalysisProvider } from './analysis/provider';
import { ShelfwiseDb } from './db';
import { createMockProvider } from './analysis/mockProvider';
import { createServices, sweepOrphanBlobs, type Services } from './index';
import type { ImageProcessor } from './images';
import { seedCatalogue } from './seed/catalogue';

const images: ImageProcessor = {
  dimensions: async () => ({ width: 4032, height: 3024 }),
  thumbnail: async () => null,
};
const photo = () => new Blob(['jpeg'], { type: 'image/jpeg' });
const config = { analysisProvider: 'mock' as const, mockLatencyMs: 0, mockFailFirstAttempt: false };

let services: Services;
let dbCount = 0;

async function setup(provider?: AnalysisProvider) {
  const db = new ShelfwiseDb(`test-${++dbCount}`);
  services = await createServices(config, { db, images, provider });
  // jsdom Blobs cannot be structured-cloned into fake-indexeddb; keep blobs in memory.
  const blobs = new Map<string, Blob>();
  services.blobs.get = async (id) => blobs.get(id);
  services.blobs.put = async (id, blob) => void blobs.set(id, blob);
  services.blobs.delete = async (id) => void blobs.delete(id);
}

async function draftWithPhotos(count: number) {
  const visit = await services.captures.startVisit('st-meny-osterbro', 'rep-alex');
  for (let i = 0; i < count; i++)
    await services.captures.addCapture(visit.id, { blob: photo(), source: 'camera' });
  return visit;
}

describe('orphan blob sweep', () => {
  it('deletes blobs no capture references', async () => {
    const db = new ShelfwiseDb(`test-sweep-${++dbCount}`);
    await db.blobs.put({ id: 'kept', blob: new Blob(['a']) });
    await db.blobs.put({ id: 'orphan', blob: new Blob(['b']) });
    await db.captures.put({
      id: 'c1',
      visitId: 'v',
      sequence: 1,
      capturedAt: '2026-11-10T10:00:00Z',
      source: 'camera',
      mimeType: 'image/jpeg',
      width: 1,
      height: 1,
      byteSize: 1,
      blobId: 'kept',
      thumbBlobId: null,
    });
    expect(await sweepOrphanBlobs(db)).toBe(1);
    expect(await db.blobs.get('kept')).toBeDefined();
  });
});

describe('current rep', () => {
  it('defaults to the seeded POC rep and keeps a valid choice', async () => {
    const db = new ShelfwiseDb(`test-rep-${++dbCount}`);
    services = await createServices(config, { db, images });
    expect(await services.repos.session.getCurrentRepId()).toBe('rep-alex');
    await services.repos.session.setCurrentRepId('rep-mette');
    services = await createServices(config, { db, images });
    expect(await services.repos.session.getCurrentRepId()).toBe('rep-mette');
    await services.repos.session.setCurrentRepId('rep-gone');
    services = await createServices(config, { db, images });
    expect(await services.repos.session.getCurrentRepId()).toBe('rep-alex');
  });
});

describe('capture drafts', () => {
  beforeEach(() => setup());

  it('resumes the open draft for the same store and rep', async () => {
    const a = await services.captures.startVisit('st-meny-osterbro', 'rep-alex');
    const b = await services.captures.startVisit('st-meny-osterbro', 'rep-alex');
    expect(b.id).toBe(a.id);
  });

  it('numbers rapid captures consecutively', async () => {
    const visit = await services.captures.startVisit('st-meny-osterbro', 'rep-alex');
    await Promise.all(
      [1, 2, 3, 4].map(() =>
        services.captures.addCapture(visit.id, { blob: photo(), source: 'camera' }),
      ),
    );
    const captures = await services.repos.captures.listByVisit(visit.id);
    expect(captures.map((c) => c.sequence)).toEqual([1, 2, 3, 4]);
  });

  it('restores a removed photo (undo) and purges images only after undo expires', async () => {
    const visit = await draftWithPhotos(3);
    const [, second] = await services.repos.captures.listByVisit(visit.id);
    const removed = await services.captures.removeCapture(second.id);
    expect((await services.repos.captures.listByVisit(visit.id)).map((c) => c.sequence)).toEqual([
      1, 3,
    ]);
    expect(await services.blobs.get(second.blobId)).toBeDefined();
    await services.captures.restoreCapture(removed!);
    expect((await services.repos.captures.listByVisit(visit.id)).map((c) => c.sequence)).toEqual([
      1, 2, 3,
    ]);
    await services.captures.purgeRemoved(removed!);
    expect(await services.blobs.get(second.blobId)).toBeDefined();

    await services.captures.removeCapture(second.id);
    await services.captures.purgeRemoved(removed!);
    expect(await services.blobs.get(second.blobId)).toBeUndefined();
  });

  it('keeps the sequence position on retake and removes photos', async () => {
    const visit = await draftWithPhotos(3);
    const [first, second] = await services.repos.captures.listByVisit(visit.id);
    const retaken = await services.captures.replaceCapture(second.id, {
      blob: photo(),
      source: 'camera',
    });
    expect(retaken.sequence).toBe(2);
    expect(retaken.blobId).not.toBe(second.blobId);
    await services.captures.removeCapture(first.id);
    expect((await services.repos.captures.listByVisit(visit.id)).map((c) => c.sequence)).toEqual([
      2, 3,
    ]);
  });
});

describe('analysis submission', () => {
  it('creates exactly one job for repeated submissions', async () => {
    await setup();
    const visit = await draftWithPhotos(4);
    const [a, b] = await Promise.all([
      services.analysis.submitVisit(visit.id),
      services.analysis.submitVisit(visit.id),
    ]);
    expect(b.id).toBe(a.id);
    await services.analysis.whenIdle(a.id);
    const job = await services.repos.jobs.get(a.id);
    expect(job?.status).toBe('completed');
    const stored = await services.repos.visits.get(visit.id);
    expect(stored).toMatchObject({ status: 'completed', resultId: `result-${a.id}` });
    await expect(
      services.captures.addCapture(visit.id, { blob: photo(), source: 'camera' }),
    ).rejects.toThrow();
  });

  it('records a retryable failure and succeeds on retry without duplicating results', async () => {
    await setup(
      createMockProvider({ catalogue: seedCatalogue, latencyMs: 0, failFirstAttempt: true }),
    );
    const visit = await draftWithPhotos(2);
    const job = await services.analysis.submitVisit(visit.id);
    await services.analysis.whenIdle(job.id);
    const failed = await services.repos.jobs.get(job.id);
    expect(failed).toMatchObject({ status: 'failed', failure: { retryable: true } });

    await services.analysis.retry(job.id);
    await services.analysis.whenIdle(job.id);
    const done = await services.repos.jobs.get(job.id);
    expect(done).toMatchObject({ status: 'completed', attempts: 2 });
    expect((await services.repos.visits.get(visit.id))?.resultId).toBe(`result-${job.id}`);
  });

  it('rejects provider output that violates the contract', async () => {
    await setup({ id: 'bad', source: 'live', analyse: async () => ({ nonsense: true }) });
    const visit = await draftWithPhotos(1);
    const job = await services.analysis.submitVisit(visit.id);
    await services.analysis.whenIdle(job.id);
    expect((await services.repos.jobs.get(job.id))?.failure?.code).toBe('invalid-response');
    expect((await services.repos.visits.get(visit.id))?.resultId).toBeNull();
  });

  it('reopening a failed submission issues a new idempotency key', async () => {
    await setup(
      createMockProvider({ catalogue: seedCatalogue, latencyMs: 0, failFirstAttempt: true }),
    );
    const visit = await draftWithPhotos(1);
    const job = await services.analysis.submitVisit(visit.id);
    await services.analysis.whenIdle(job.id);
    await services.captures.reopenDraft(visit.id);
    const reopened = await services.repos.visits.get(visit.id);
    expect(reopened).toMatchObject({ status: 'draft', jobId: null });
    expect(reopened?.idempotencyKey).not.toBe(visit.idempotencyKey);
    expect((await services.repos.jobs.get(job.id))?.status).toBe('cancelled');
  });
});

describe('concurrency', () => {
  it('does not complete a job after the rep reopened the draft', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const mock = createMockProvider({
      catalogue: seedCatalogue,
      latencyMs: 0,
      failFirstAttempt: false,
    });
    await setup({
      id: 'slow',
      source: 'mock',
      analyse: async (input) => {
        await gate;
        return mock.analyse(input);
      },
    });
    const visit = await draftWithPhotos(1);
    const job = await services.analysis.submitVisit(visit.id);
    await new Promise((r) => setTimeout(r, 20));
    await services.captures.reopenDraft(visit.id);
    release();
    await services.analysis.whenIdle(job.id);
    expect(await services.repos.visits.get(visit.id)).toMatchObject({
      status: 'draft',
      resultId: null,
    });
    expect((await services.repos.jobs.get(job.id))?.status).toBe('cancelled');
    expect(await services.repos.results.get(`result-${job.id}`)).toBeUndefined();
  });

  it('waits for in-flight captures before submitting', async () => {
    let imagesSent = 0;
    const mock = createMockProvider({
      catalogue: seedCatalogue,
      latencyMs: 0,
      failFirstAttempt: false,
    });
    await setup({
      id: 'count',
      source: 'mock',
      analyse: async (input) => {
        imagesSent = input.images.length;
        return mock.analyse(input);
      },
    });
    const visit = await draftWithPhotos(1);
    const [, job] = await Promise.all([
      services.captures.addCapture(visit.id, { blob: photo(), source: 'camera' }),
      services.analysis.submitVisit(visit.id),
    ]);
    await services.analysis.whenIdle(job.id);
    expect(imagesSent).toBe(2);
  });
});

describe('mock provider', () => {
  const request = (count: number, width = 4032, height = 3024) => ({
    schemaVersion: '1.0.0' as const,
    jobId: 'job-x',
    visitId: 'visit-x',
    idempotencyKey: 'idem-x',
    store: { storeId: 's', chain: 'Netto', countryCode: 'DK' as const },
    catalogueVersion: seedCatalogue.version,
    methodVersion: 'm',
    images: Array.from({ length: count }, (_, i) => ({
      imageId: `img-${i + 1}`,
      sequence: i + 1,
      capturedAt: '2026-11-10T13:00:00.000Z',
      mimeType: 'image/jpeg',
      width,
      height,
      byteSize: 1000,
    })),
  });

  it.each([1, 2, 3, 6, 9])('produces a contract-valid result for %i photos', (count) => {
    const result = generateMockAnalysis(request(count), seedCatalogue);
    const parsed = analysisResponseSchema.safeParse(result);
    expect(parsed.success, JSON.stringify(parsed.error?.issues[0])).toBe(true);
  });

  it('is deterministic per visit', () => {
    const a = generateMockAnalysis(request(4), seedCatalogue, '2026-11-10T13:00:00Z');
    const b = generateMockAnalysis(request(4), seedCatalogue, '2026-11-10T13:00:00Z');
    expect(a).toEqual(b);
  });

  it('includes overlap, reflections, unknowns, promotions and displays', () => {
    const result = generateMockAnalysis(request(6), seedCatalogue);
    const metrics = computeVisitMetrics(result, [], indexCatalogue(seedCatalogue));
    expect(metrics.coverage.duplicatesMerged).toBeGreaterThan(0);
    expect(result.warnings.map((w) => w.code)).toContain('reflection');
    expect(metrics.unresolved.facings).toBeGreaterThan(0);
    expect(result.promotions.map((p) => p.mechanic)).toEqual(expect.arrayContaining(['multibuy']));
    expect(metrics.displays.count).toBe(1);
    expect(metrics.scopes.shelf.sos.sharePct).not.toBeNull();
    expect(metrics.scopes.cooler.sos.sharePct).not.toBeNull();
  });

  it('marks low-resolution photos unusable', () => {
    const result = generateMockAnalysis(request(2, 320, 240), seedCatalogue);
    expect(result.images.every((i) => !i.usable)).toBe(true);
    expect(result.status).toBe('partial');
  });
});
