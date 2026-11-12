import { unzipSync, strFromU8 } from 'fflate';
import { webcrypto } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { ANALYSIS_SCHEMA_VERSION, type AnalysisResponse } from '@/contracts/analysis';
import { indexCatalogue } from '@/domain/catalogue';
import type { Correction } from '@/domain/corrections';
import { isTrainingExportable, recordDataUse } from '@/domain/dataUse';
import type { Capture, StoredResult, Visit } from '@/domain/models';
import { facingKey } from '@/domain/overlap';
import { ShelfwiseDb } from '../db';
import { deviceFamily } from '../deviceInfo';
import type { ImageProcessor } from '../images';
import { applyRetention, createServices, type Services } from '../index';
import { seedCatalogue } from '../seed/catalogue';
import { buildLabels } from './coco';
import { exportTrainingPackage, NothingToExportError } from './exportPackage';
import { TRAINING_PACKAGE_FORMAT, TRAINING_PACKAGE_VERSION } from './format';
import { hasJpegMetadata, stripJpegMetadata } from './jpeg';
import { buildManifest } from './manifest';
import { createImageSanitizer } from './sanitize';

beforeAll(() => {
  // jsdom's crypto has no SubtleCrypto; Node's is the same Web Crypto API.
  if (!globalThis.crypto?.subtle) {
    Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
  }
});

const catalogue = indexCatalogue(seedCatalogue);
const product = seedCatalogue.products[0];
const segment = (marker: number, payload: number[]) => {
  const length = payload.length + 2;
  return [0xff, marker, length >> 8, length & 0xff, ...payload];
};
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));
/** Tiny JPEG-shaped bytes: JFIF, EXIF (with "GPS"), ICC, comment, quant table, scan. */
function jpeg({ metadata }: { metadata: boolean }) {
  return new Uint8Array([
    0xff,
    0xd8,
    ...segment(0xe0, ascii('JFIF\0')),
    ...(metadata ? segment(0xe1, ascii('Exif\0\0GPS-55.67N')) : []),
    ...segment(0xe2, ascii('ICC_PROFILE\0')),
    ...(metadata ? segment(0xfe, ascii('comment')) : []),
    ...segment(0xdb, [0, 1, 2, 3]),
    0xff,
    0xda,
    0,
    2,
    9,
    8,
    7,
    0xff,
    0xd9,
  ]);
}
const contains = (bytes: Uint8Array, text: string) => strFromU8(bytes, true).includes(text);

describe('JPEG metadata', () => {
  it('finds and strips EXIF/GPS and comments but keeps JFIF, ICC and image data', () => {
    const withMeta = jpeg({ metadata: true });
    expect(hasJpegMetadata(withMeta)).toBe(true);
    expect(hasJpegMetadata(jpeg({ metadata: false }))).toBe(false);
    const stripped = stripJpegMetadata(withMeta)!;
    expect(hasJpegMetadata(stripped)).toBe(false);
    expect(contains(stripped, 'GPS')).toBe(false);
    expect(contains(stripped, 'comment')).toBe(false);
    expect(contains(stripped, 'JFIF')).toBe(true);
    expect(contains(stripped, 'ICC_PROFILE')).toBe(true);
    expect([...stripped]).toEqual([...jpeg({ metadata: false })]);
  });

  it('refuses malformed files', () => {
    expect(stripJpegMetadata(new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0, 99]))).toBeNull();
    expect(stripJpegMetadata(new Uint8Array([1, 2, 3, 4]))).toBeNull();
  });

  it('shares camera photos as-is and re-encodes or strips imports with metadata', async () => {
    const clean = jpeg({ metadata: false });
    const reencodeTo = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])]);
    const sanitize = createImageSanitizer(async () => reencodeTo);
    expect(await sanitize(new Blob([clean]))).toEqual({
      bytes: clean,
      mimeType: 'image/jpeg',
      reencoded: false,
    });
    expect((await sanitize(new Blob([jpeg({ metadata: true })])))!.reencoded).toBe(true);
    const failing = createImageSanitizer(async () => {
      throw new Error('no decoder');
    });
    const stripped = await failing(new Blob([jpeg({ metadata: true })]));
    expect(hasJpegMetadata(stripped!.bytes)).toBe(false);
    expect(await failing(new Blob(['not an image']))).toBeNull();
  });
});

describe('training consent filter', () => {
  const now = new Date('2026-11-11T12:00:00Z');
  const base: Pick<Visit, 'status' | 'resultId' | 'dataUse'> = {
    status: 'completed',
    resultId: 'result-1',
    dataUse: {
      trainingConsent: true,
      consentRecordedAt: '2026-11-10T10:00:00Z',
      retainUntil: '2027-11-10T10:00:00.000Z',
    },
  };

  it('exports only analysed, consented visits within retention', () => {
    expect(isTrainingExportable(base, now)).toBe(true);
    expect(isTrainingExportable({ ...base, status: 'draft' }, now)).toBe(false);
    expect(isTrainingExportable({ ...base, resultId: null }, now)).toBe(false);
    expect(isTrainingExportable({ ...base, dataUse: undefined }, now)).toBe(false);
    expect(
      isTrainingExportable({ ...base, dataUse: { ...base.dataUse!, trainingConsent: false } }, now),
    ).toBe(false);
    expect(
      isTrainingExportable(
        { ...base, dataUse: { ...base.dataUse!, retainUntil: '2026-11-11T11:59:59Z' } },
        now,
      ),
    ).toBe(false);
  });

  it('re-records consent but keeps the original retention date', () => {
    const first = recordDataUse({ createdAt: '2026-01-01T00:00:00.000Z' }, false, 'a', 30);
    expect(first.retainUntil).toBe('2026-01-31T00:00:00.000Z');
    const again = recordDataUse(
      { createdAt: '2026-01-01T00:00:00.000Z', dataUse: first },
      true,
      'b',
      365,
    );
    expect(again).toEqual({
      trainingConsent: true,
      consentRecordedAt: 'b',
      retainUntil: first.retainUntil,
    });
  });
});

function fixture() {
  const visit = {
    id: 'visit-1',
    status: 'completed',
    resultId: 'result-job-1',
  } as Visit;
  const capture = (id: string, sequence: number) =>
    ({
      id,
      visitId: 'visit-1',
      sequence,
      capturedAt: '2026-11-11T10:00:00.000Z',
      width: 4000,
      height: 3000,
    }) as Capture;
  const match = (status: 'matched' | 'candidate' | 'unknown') => ({
    status,
    productId: status === 'unknown' ? null : product.id,
    brandId: null,
    category: status === 'unknown' ? null : product.category,
    providerScore: status === 'unknown' ? null : 0.8,
  });
  const response: AnalysisResponse = {
    schemaVersion: ANALYSIS_SCHEMA_VERSION,
    jobId: 'job-1',
    visitId: 'visit-1',
    status: 'completed',
    source: 'mock',
    provider: { name: 'mock', model: null },
    methodVersion: 'sos-visible-facings-v1',
    catalogueVersion: 'dk-seed-2026.11',
    analysedAt: '2026-11-11T10:05:00.000Z',
    images: [
      { imageId: 'cap-1', usable: true, locationType: 'shelf', locationId: 'loc-1', issues: [] },
      { imageId: 'cap-2', usable: true, locationType: 'shelf', locationId: 'loc-1', issues: [] },
    ],
    locations: [{ locationId: 'loc-1', type: 'shelf', label: 'Shelf 1', imageIds: ['cap-1'] }],
    facings: [
      {
        facingId: 'f-1',
        imageId: 'cap-1',
        locationId: 'loc-1',
        physicalPositionId: 'p-1',
        region: { x: 0.1, y: 0.2, width: 0.05, height: 0.3 },
        match: match('matched'),
      },
      {
        facingId: 'f-2',
        imageId: 'cap-2',
        locationId: 'loc-1',
        physicalPositionId: 'p-2',
        region: { x: 0.5, y: 0.5, width: 0.1, height: 0.1 },
        match: match('unknown'),
      },
      {
        facingId: 'f-3',
        imageId: 'cap-1',
        locationId: 'loc-1',
        physicalPositionId: null,
        region: null,
        match: match('candidate'),
      },
    ],
    priceLabels: [
      {
        labelId: 'l-1',
        imageId: 'cap-1',
        locationId: 'loc-1',
        physicalLabelId: null,
        region: { x: 0, y: 0.9, width: 0.1, height: 0.05 },
        rawText: '2 for 30',
        status: 'unresolved',
        unresolvedReason: 'ambiguous-condition',
        match: match('candidate'),
        priceType: 'promotion',
        amountOre: null,
        currency: 'DKK',
        deposit: { shown: true, amountOre: 100, included: false },
        pack: { units: 1, volumeMl: 330 },
        multibuy: { quantity: 2, totalOre: 3000 },
        conditionText: null,
        promotionId: null,
      },
    ],
    promotions: [],
    displays: [],
    warnings: [],
    failure: null,
    narrative: null,
  };
  const result: StoredResult = {
    id: 'result-job-1',
    visitId: 'visit-1',
    jobId: 'job-1',
    storedAt: response.analysedAt,
    response,
  };
  const base = { resultId: result.id, visitId: 'visit-1', repId: 'rep-alex' };
  const corrections: Correction[] = [
    {
      ...base,
      id: 'c-old',
      createdAt: '2026-11-11T10:06:00Z',
      targetKind: 'facing',
      targetId: facingKey(response.facings[1]),
      value: { kind: 'unknown' },
    },
    {
      ...base,
      id: 'c-new',
      createdAt: '2026-11-11T10:07:00Z',
      targetKind: 'facing',
      targetId: facingKey(response.facings[1]),
      value: { kind: 'product', productId: product.id },
    },
    {
      ...base,
      id: 'c-price',
      createdAt: '2026-11-11T10:08:00Z',
      targetKind: 'price-label',
      targetId: 'l-1',
      value: { kind: 'price', amountOre: 1500, priceType: 'promotion' },
    },
  ];
  return { visit, captures: [capture('cap-1', 1), capture('cap-2', 2)], result, corrections };
}

describe('COCO draft labels', () => {
  const files = new Map([
    ['cap-1', 'images/visit-1/001-cap-1.jpg'],
    ['cap-2', 'images/visit-1/002-cap-2.jpg'],
  ]);

  it('converts boxes to pixels with product attributes and a separate provider score', () => {
    const { coco, stats } = buildLabels([fixture()], catalogue, files, 'now');
    expect(coco.images.map((i) => i.file_name)).toEqual([...files.values()]);
    expect(coco.categories.map((c) => c.name)).toEqual([
      'facing',
      'price_label',
      'promotion',
      'display',
    ]);
    const [matched, unknown, label] = coco.annotations;
    expect(matched).toMatchObject({
      image_id: 1,
      category_id: 1,
      bbox: [400, 600, 200, 900],
      area: 180000,
      provider_score: 0.8,
      attributes: {
        kind: 'facing',
        observationId: 'f-1',
        source: 'mock',
        matchStatus: 'matched',
        productId: product.id,
        brandId: product.brandId,
        locationType: 'shelf',
        needsReview: false,
      },
    });
    expect(matched.attributes).not.toHaveProperty('providerScore');
    expect(catalogue.brandById.get(product.brandId)?.relation).toBe(
      matched.attributes.brandRelation,
    );
    expect(unknown).toMatchObject({
      image_id: 2,
      bbox: [2000, 1500, 400, 300],
      provider_score: null,
      attributes: { matchStatus: 'unknown', productId: null, needsReview: true },
    });
    expect(label).toMatchObject({
      category_id: 2,
      attributes: { kind: 'price_label', status: 'unresolved', needsReview: true },
    });
    // The unboxed candidate is counted, not exported as a box.
    expect(stats).toMatchObject({
      images: 2,
      annotations: { facing: 2, price_label: 1, promotion: 0, display: 0 },
      withoutBox: 1,
      needsReview: 2,
      corrections: 3,
    });
  });

  it('keeps rep corrections as a separate layer linked to the annotations', () => {
    const { coco, corrections } = buildLabels([fixture()], catalogue, files, 'now');
    expect(corrections.format).toBe('shelfwise-corrections');
    const [older, newer, price] = corrections.corrections;
    const unknownId = coco.annotations.find((a) => a.attributes.observationId === 'f-2')!.id;
    expect(older).toMatchObject({
      correctionId: 'c-old',
      annotationIds: [unknownId],
      latest: false,
    });
    expect(newer).toMatchObject({
      correctionId: 'c-new',
      observationIds: ['f-2'],
      latest: true,
      value: { kind: 'product', productId: product.id },
    });
    expect(price).toMatchObject({ targetKind: 'price-label', annotationIds: [3], latest: true });
    expect(newer).not.toHaveProperty('repId');
    // Draft labels themselves are not altered by corrections.
    expect(coco.annotations[1].attributes.matchStatus).toBe('unknown');
  });

  it('skips images that are not in the package', () => {
    const { coco } = buildLabels([fixture()], catalogue, new Map([['cap-1', 'a.jpg']]), 'now');
    expect(coco.images).toHaveLength(1);
    expect(coco.annotations.every((a) => a.image_id === 1)).toBe(true);
  });
});

describe('manifest', () => {
  it('records format, versions, counts and privacy flags', () => {
    const { stats } = buildLabels([fixture()], catalogue, new Map([['cap-1', 'a.jpg']]), 'now');
    const manifest = buildManifest({
      exportedAt: '2026-11-11T12:00:00.000Z',
      app: { version: '0.1.0', commit: 'abc1234' },
      scope: { kind: 'all' },
      catalogueVersions: ['dk-seed-2026.11', 'dk-seed-2026.11'],
      methodVersions: ['sos-visible-facings-v1'],
      sources: ['mock', 'mock'],
      visitIds: ['visit-1'],
      stats,
      imagesSkipped: 1,
      imagesReencoded: 0,
      files: [{ path: 'README.md', bytes: 10, sha256: 'x' }],
    });
    expect(manifest).toMatchObject({
      format: TRAINING_PACKAGE_FORMAT,
      packageVersion: TRAINING_PACKAGE_VERSION,
      app: { name: 'shelfwise', version: '0.1.0', commit: 'abc1234' },
      versions: {
        analysisSchema: ANALYSIS_SCHEMA_VERSION,
        catalogue: ['dk-seed-2026.11'],
        coco: '1.0',
      },
      labelSources: ['mock'],
      counts: { visits: 1, images: 1, imagesSkipped: 1 },
      privacy: { locationData: false, repIdentity: false, imageMetadataStripped: true },
    });
  });
});

describe('device family', () => {
  it('keeps only platform/browser family', () => {
    const iphone =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
    const android =
      'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36';
    expect(deviceFamily(iphone)).toEqual({ platform: 'ios', browser: 'safari', mobile: true });
    expect(deviceFamily(android)).toEqual({ platform: 'android', browser: 'chrome', mobile: true });
    expect(deviceFamily('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605', 5)).toEqual({
      platform: 'ios',
      browser: 'safari',
      mobile: true,
    });
  });
});

describe('data use in the services', () => {
  const images: ImageProcessor = {
    dimensions: async () => ({ width: 4000, height: 3000 }),
    thumbnail: async () => new Blob(['thumb'], { type: 'image/jpeg' }),
  };
  const config = {
    analysisProvider: 'mock' as const,
    mockLatencyMs: 0,
    mockFailFirstAttempt: false,
    overlapTarget: 0.25,
    retentionDays: 30,
    devTools: false,
    copilotStudio: {
      directConnectUrl: null,
      environmentId: null,
      schemaName: null,
      tenantId: null,
      clientId: null,
      cloud: 'Prod',
    },
  };
  let count = 0;
  async function setup() {
    const db = new ShelfwiseDb(`training-${++count}`);
    const services = await createServices(config, { db, images });
    const blobs = new Map<string, Blob>();
    services.blobs.get = async (id) => blobs.get(id);
    services.blobs.put = async (id, blob) => void blobs.set(id, blob);
    services.blobs.delete = async (id) => void blobs.delete(id);
    return { db, services, blobs };
  }
  async function analysedVisit(services: Services, photos: Blob[]) {
    const visit = await services.captures.startVisit('st-meny-osterbro', 'rep-alex');
    for (const blob of photos)
      await services.captures.addCapture(visit.id, {
        blob,
        source: 'camera',
        camera: {
          facingMode: 'environment',
          zoom: 1,
          torch: false,
          trackWidth: 3840,
          trackHeight: 2160,
        },
      });
    const job = await services.analysis.submitVisit(visit.id);
    await services.analysis.whenIdle(job.id);
    return (await services.repos.visits.get(visit.id))!;
  }

  it('records consent per visit at submission, defaulting to off', async () => {
    const { services } = await setup();
    expect(await services.repos.settings.getTrainingConsent('rep-alex')).toBe(false);
    const off = await analysedVisit(services, [new Blob([jpeg({ metadata: false })])]);
    expect(off.dataUse).toMatchObject({ trainingConsent: false });
    expect(Date.parse(off.dataUse!.retainUntil) - Date.parse(off.createdAt)).toBe(30 * 86_400_000);

    // Turned on mid-visit: the setting at submission time applies.
    const draft = await services.captures.startVisit('st-netto-aarhus-c', 'rep-alex');
    expect(draft.dataUse?.trainingConsent).toBe(false);
    await services.repos.settings.setTrainingConsent('rep-alex', true);
    await services.captures.addCapture(draft.id, {
      blob: new Blob([jpeg({ metadata: false })]),
      source: 'camera',
    });
    const job = await services.analysis.submitVisit(draft.id);
    await services.analysis.whenIdle(job.id);
    expect((await services.repos.visits.get(draft.id))!.dataUse!.trainingConsent).toBe(true);
    // Already-submitted visits are never changed retroactively.
    expect((await services.repos.visits.get(off.id))!.dataUse!.trainingConsent).toBe(false);
  });

  it('stores coarse capture metadata without location', async () => {
    const { services } = await setup();
    const visit = await services.captures.startVisit('st-meny-osterbro', 'rep-alex');
    const c = await services.captures.addCapture(visit.id, {
      blob: new Blob(['x'], { type: 'image/jpeg' }),
      source: 'import',
      capturedAt: new Date('2026-11-01T09:00:00Z'),
    });
    expect(c).toMatchObject({
      source: 'import',
      capturedAt: '2026-11-01T09:00:00.000Z',
      containsPeople: 'unknown',
      camera: null,
      width: 4000,
      height: 3000,
    });
    expect(c.storedAt).toBeDefined();
    expect(JSON.stringify(c)).not.toMatch(/latitude|longitude|geo/i);
  });

  it('exports a consented visit as a zip package and refuses unconsented ones', async () => {
    const { services } = await setup();
    const off = await analysedVisit(services, [new Blob([jpeg({ metadata: false })])]);
    const deps = {
      repos: services.repos,
      blobs: services.blobs,
      catalogue: services.catalogue,
      sanitize: createImageSanitizer(async () => new Blob([jpeg({ metadata: false })])),
      app: { version: '0.1.0', commit: 'abc1234' },
    };
    await expect(exportTrainingPackage(deps, { kind: 'visit', visitId: off.id })).rejects.toThrow(
      NothingToExportError,
    );

    await services.repos.settings.setTrainingConsent('rep-alex', true);
    const visit = await analysedVisit(services, [
      new Blob([jpeg({ metadata: false })]),
      new Blob([jpeg({ metadata: true })]),
    ]);
    const result = (await services.repos.results.get(visit.resultId!))!;
    const facing = result.response.facings[0];
    await services.repos.corrections.add({
      id: 'corr-1',
      resultId: result.id,
      visitId: visit.id,
      repId: 'rep-alex',
      createdAt: new Date().toISOString(),
      targetKind: 'facing',
      targetId: facingKey(facing),
      value: { kind: 'not-beverage' },
    });

    const progress: number[] = [];
    const out = await exportTrainingPackage(deps, { kind: 'all' }, (done) => progress.push(done));
    expect(out.fileName).toMatch(/^shelfwise-training-\d{8}-\d{4}-all\.zip$/);
    expect(progress).toEqual([1, 2]);
    const zip = unzipSync(new Uint8Array(await out.blob.arrayBuffer()));
    const names = Object.keys(zip).sort();
    const captures = await services.repos.captures.listByVisit(visit.id);
    expect(names).toEqual(
      [
        'README.md',
        'manifest.json',
        'metadata/visits.json',
        'metadata/images.json',
        'labels/draft.coco.json',
        'labels/corrections.json',
        ...captures.map(
          (c) => `images/${visit.id}/${String(c.sequence).padStart(3, '0')}-${c.id}.jpg`,
        ),
      ].sort(),
    );
    const json = (name: string) => JSON.parse(strFromU8(zip[name]));
    const manifest = json('manifest.json');
    expect(manifest).toMatchObject({
      format: 'shelfwise-training',
      counts: { visits: 1, images: 2, imagesReencoded: 1, imagesSkipped: 0 },
      labelSources: ['mock'],
    });
    // Every file except the manifest is listed with its hash.
    expect(manifest.files.map((f: { path: string }) => f.path).sort()).toEqual(
      names.filter((n) => n !== 'manifest.json').sort(),
    );
    for (const f of manifest.files as { path: string; bytes: number; sha256: string }[]) {
      const digest = await crypto.subtle.digest('SHA-256', zip[f.path] as BufferSource);
      const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
      expect([f.path, zip[f.path].length, hex]).toEqual([f.path, f.bytes, f.sha256]);
    }
    // Photos carry no metadata in the package.
    for (const c of captures) {
      expect(
        hasJpegMetadata(
          zip[`images/${visit.id}/${String(c.sequence).padStart(3, '0')}-${c.id}.jpg`],
        ),
      ).toBe(false);
    }
    const coco = json('labels/draft.coco.json');
    expect(coco.images).toHaveLength(2);
    expect(coco.annotations.length).toBeGreaterThan(0);
    expect(json('labels/corrections.json').corrections).toMatchObject([
      { correctionId: 'corr-1', value: { kind: 'not-beverage' }, latest: true },
    ]);
    const [visitMeta] = json('metadata/visits.json');
    expect(visitMeta).toMatchObject({ visitId: visit.id, dataUse: { trainingConsent: true } });
    expect(visitMeta).not.toHaveProperty('repId');
    expect(json('metadata/images.json')[0]).toMatchObject({
      source: 'camera',
      camera: { facingMode: 'environment', zoom: 1 },
      containsPeople: 'unknown',
    });
  });

  it('purges originals of expired analysed visits only, keeping thumbnails', async () => {
    const { db, services, blobs } = await setup();
    const done = await analysedVisit(services, [new Blob([jpeg({ metadata: false })])]);
    const draft = await services.captures.startVisit('st-netto-aarhus-c', 'rep-alex');
    await services.captures.addCapture(draft.id, { blob: new Blob(['d']), source: 'camera' });
    // Real blob storage for the sweep (the services above use an in-memory map).
    for (const [id, blob] of blobs) await db.blobs.put({ id, blob });

    expect(await applyRetention(db, new Date())).toBe(0);
    const later = new Date(Date.now() + 31 * 86_400_000);
    expect(await applyRetention(db, later)).toBe(1);
    const [purged] = await db.captures.where('visitId').equals(done.id).toArray();
    expect(purged.blobId).toBe(purged.thumbBlobId);
    expect(purged.originalPurgedAt).toBe(later.toISOString());
    const [kept] = await db.captures.where('visitId').equals(draft.id).toArray();
    expect(kept.originalPurgedAt).toBeNull();
    expect(await db.blobs.get(kept.blobId)).toBeDefined();
    // Expired visits are no longer exportable.
    expect(isTrainingExportable((await db.visits.get(done.id))!, later)).toBe(false);
  });
});
