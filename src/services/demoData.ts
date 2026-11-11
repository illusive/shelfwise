import { analysisRequestSchema, ANALYSIS_SCHEMA_VERSION } from '@/contracts/analysis';
import type { Capture, Visit } from '@/domain/models';
import { SOS_METHOD_VERSION } from '@/domain/sos';
import { generateMockAnalysis, MOCK_PROVIDER_ID } from './analysis/mockProvider';
import { newId } from './ids';
import type { Services } from './index';
import { PHOTO_MIME } from './images';

const SHELF_COLOURS = [
  '#c8102e',
  '#00843d',
  '#1d4f91',
  '#f2a900',
  '#e35205',
  '#6d2077',
  '#ffffff',
  '#00a3e0',
  '#2d2926',
];

/** Draws a stylised shelf or cooler photo so demo history has real image blobs. */
async function renderDemoPhoto(seed: number, cooler: boolean): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = 1600;
  canvas.height = 1200;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = cooler ? '#1f2d2a' : '#d9d4c7';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const rows = 5;
  const rowH = canvas.height / rows;
  let n = seed;
  const next = () => (n = (n * 9301 + 49297) % 233280) / 233280;
  for (let r = 0; r < rows; r++) {
    let x = 20;
    while (x < canvas.width - 40) {
      const w = 70 + next() * 40;
      const colour = SHELF_COLOURS[Math.floor(next() * SHELF_COLOURS.length)];
      const count = 2 + Math.floor(next() * 3);
      for (let i = 0; i < count && x < canvas.width - 40; i++) {
        ctx.fillStyle = colour;
        ctx.beginPath();
        ctx.roundRect(x, r * rowH + 30, w - 8, rowH * 0.66, 10);
        ctx.fill();
        x += w;
      }
    }
    ctx.fillStyle = cooler ? '#3c4a46' : '#8b8576';
    ctx.fillRect(0, r * rowH + rowH * 0.8, canvas.width, 10);
    ctx.fillStyle = '#fafaf5';
    for (let lx = 40; lx < canvas.width; lx += 260)
      ctx.fillRect(lx, r * rowH + rowH * 0.83, 120, 34);
  }
  if (cooler) {
    const glare = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    glare.addColorStop(0.3, 'rgba(255,255,255,0)');
    glare.addColorStop(0.45, 'rgba(255,255,255,0.35)');
    glare.addColorStop(0.6, 'rgba(255,255,255,0)');
    ctx.fillStyle = glare;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Render failed'))), PHOTO_MIME, 0.85),
  );
}

/**
 * Seeds two analysed (mock) visits per assigned store, backdated, so Home, Archive and visit
 * comparisons have history to show. Uses the same contract and metrics as real submissions.
 */
export async function addDemoHistory(services: Services, repId: string): Promise<number> {
  const { repos } = services;
  const stores = (await repos.stores.list())
    .filter((s) => s.assignedRepIds.includes(repId))
    .slice(0, 3);
  let created = 0;
  for (const [storeIndex, store] of stores.entries()) {
    for (const daysAgo of [16, 5]) {
      const start = new Date(Date.now() - daysAgo * 86_400_000);
      start.setHours(10 + storeIndex * 2, 12, 0, 0);
      const visit: Visit = {
        id: newId('visit'),
        storeId: store.id,
        repId,
        status: 'draft',
        idempotencyKey: newId('idem'),
        jobId: null,
        resultId: null,
        createdAt: start.toISOString(),
        updatedAt: start.toISOString(),
        submittedAt: null,
        completedAt: null,
      };
      await repos.visits.put(visit);
      const photoCount = daysAgo > 10 ? 4 : 5;
      const captures: Capture[] = [];
      for (let i = 0; i < photoCount; i++) {
        const capturedAt = new Date(start.getTime() + i * 90_000);
        const blob = await renderDemoPhoto(
          storeIndex * 100 + daysAgo * 10 + i,
          i >= photoCount - 2,
        );
        captures.push(
          await services.captures.addCapture(visit.id, { blob, source: 'demo', capturedAt }),
        );
      }
      const submittedAt = new Date(start.getTime() + photoCount * 90_000 + 60_000).toISOString();
      const analysedAt = new Date(start.getTime() + photoCount * 90_000 + 120_000).toISOString();
      const jobId = newId('job');
      const request = analysisRequestSchema.parse({
        schemaVersion: ANALYSIS_SCHEMA_VERSION,
        jobId,
        visitId: visit.id,
        idempotencyKey: visit.idempotencyKey,
        store: { storeId: store.id, chain: store.chain, countryCode: 'DK' },
        catalogueVersion: services.catalogue.version,
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
      const response = generateMockAnalysis(request, services.catalogue, analysedAt);
      const resultId = `result-${jobId}`;
      await repos.jobs.put({
        id: jobId,
        visitId: visit.id,
        idempotencyKey: visit.idempotencyKey,
        providerId: MOCK_PROVIDER_ID,
        status: 'completed',
        attempts: 1,
        progress: null,
        failure: null,
        createdAt: submittedAt,
        updatedAt: analysedAt,
      });
      await repos.results.put({
        id: resultId,
        visitId: visit.id,
        jobId,
        storedAt: analysedAt,
        response,
      });
      await repos.visits.update(visit.id, {
        status: 'completed',
        jobId,
        resultId,
        submittedAt,
        completedAt: analysedAt,
        updatedAt: analysedAt,
      });
      created += 1;
    }
  }
  return created;
}
