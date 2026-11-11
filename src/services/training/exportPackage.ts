import { Zip, ZipDeflate, ZipPassThrough } from 'fflate';
import type { CatalogueIndex } from '@/domain/catalogue';
import { isTrainingExportable } from '@/domain/dataUse';
import type { Capture, Store, Visit } from '@/domain/models';
import type { BlobStore, Repositories } from '../repositories';
import { buildLabels, type ExportVisit } from './coco';
import { PACKAGE_FILES } from './format';
import { buildManifest, type PackageFile, type TrainingManifest } from './manifest';
import { packageReadme } from './readme';
import type { ImageSanitizer } from './sanitize';

export type ExportScope = { kind: 'visit'; visitId: string } | { kind: 'all' };

export interface TrainingExportDeps {
  repos: Repositories;
  blobs: BlobStore;
  catalogue: CatalogueIndex;
  sanitize: ImageSanitizer;
  app: { version: string; commit: string };
  now?: () => Date;
}

export interface TrainingExport {
  blob: Blob;
  fileName: string;
  manifest: TrainingManifest;
}

export class NothingToExportError extends Error {
  constructor() {
    super('No analysed visits with training consent to export.');
  }
}

/** Visits that may be exported now: analysed, consented and within retention. */
export async function listExportableVisits(repos: Repositories, now = new Date()) {
  return (await repos.visits.list()).filter((v) => isTrainingExportable(v, now));
}

const encoder = new TextEncoder();

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

function stamp(date: Date) {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
}

/**
 * Streams a training package into a zip: each photo is read, sanitised and written one at a
 * time, so peak memory is about the finished zip plus one photo (not every photo twice).
 */
export async function exportTrainingPackage(
  deps: TrainingExportDeps,
  scope: ExportScope,
  onProgress?: (done: number, total: number) => void,
): Promise<TrainingExport> {
  const { repos, blobs } = deps;
  const now = (deps.now ?? (() => new Date()))();
  const exportedAt = now.toISOString();

  const candidates =
    scope.kind === 'visit'
      ? [await repos.visits.get(scope.visitId)].filter((v): v is Visit => v !== undefined)
      : await repos.visits.list();
  const visits = candidates
    .filter((v) => isTrainingExportable(v, now))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  if (visits.length === 0) throw new NothingToExportError();

  // Zip output is collapsed into Blobs every ~16 MB; browsers can keep large Blobs on disk.
  const chunks: Blob[] = [];
  let parts: Uint8Array[] = [];
  let partBytes = 0;
  const collapse = () => {
    if (parts.length) chunks.push(new Blob(parts as BlobPart[]));
    parts = [];
    partBytes = 0;
  };
  let zipError: Error | null = null;
  const zip = new Zip((error, chunk) => {
    if (error) {
      zipError = error;
      return;
    }
    parts.push(chunk);
    partBytes += chunk.length;
    if (partBytes > 16 * 1024 * 1024) collapse();
  });
  const files: PackageFile[] = [];
  const write = async (path: string, bytes: Uint8Array, compress: boolean) => {
    const entry = compress ? new ZipDeflate(path, { level: 6 }) : new ZipPassThrough(path);
    zip.add(entry);
    entry.push(bytes, true);
    if (zipError) throw zipError;
    files.push({ path, bytes: bytes.length, sha256: await sha256(bytes) });
  };
  const writeJson = (path: string, value: unknown) =>
    write(path, encoder.encode(`${JSON.stringify(value, null, 2)}\n`), true);

  await write(PACKAGE_FILES.readme, encoder.encode(packageReadme(exportedAt)), true);

  const exportVisits: ExportVisit[] = [];
  const stores = new Map<string, Store | undefined>();
  const fileNames = new Map<string, string>();
  const imageMeta: Record<string, unknown>[] = [];
  const total = (await Promise.all(visits.map((v) => repos.captures.listByVisit(v.id)))).reduce(
    (n, list) => n + list.length,
    0,
  );
  let done = 0;
  let skipped = 0;
  let reencoded = 0;

  for (const visit of visits) {
    const result = await repos.results.get(visit.resultId!);
    if (!result) continue;
    if (!stores.has(visit.storeId))
      stores.set(visit.storeId, await repos.stores.get(visit.storeId));
    const captures = await repos.captures.listByVisit(visit.id);
    const included: Capture[] = [];
    for (const capture of captures) {
      const blob = capture.originalPurgedAt ? undefined : await blobs.get(capture.blobId);
      const clean = blob ? await deps.sanitize(blob) : null;
      done += 1;
      onProgress?.(done, total);
      if (!clean) {
        skipped += 1;
        continue;
      }
      if (clean.reencoded) reencoded += 1;
      const path = `images/${visit.id}/${pad(capture.sequence, 3)}-${capture.id}.jpg`;
      await write(path, clean.bytes, false);
      fileNames.set(capture.id, path);
      included.push(capture);
      imageMeta.push({
        imageId: capture.id,
        visitId: visit.id,
        file: path,
        sequence: capture.sequence,
        capturedAt: capture.capturedAt,
        storedAt: capture.storedAt ?? null,
        source: capture.source,
        mimeType: clean.mimeType,
        width: capture.width,
        height: capture.height,
        originalBytes: capture.byteSize,
        exportedBytes: clean.bytes.length,
        reencoded: clean.reencoded,
        placement: capture.placement ?? null,
        device: capture.device ?? null,
        camera: capture.camera ?? null,
        containsPeople: capture.containsPeople ?? 'unknown',
      });
    }
    exportVisits.push({
      visit,
      captures: included,
      result,
      corrections: await repos.corrections.listByResult(result.id),
    });
  }

  const { coco, corrections, stats } = buildLabels(
    exportVisits,
    deps.catalogue,
    fileNames,
    exportedAt,
  );
  await writeJson(
    PACKAGE_FILES.visits,
    exportVisits.map(({ visit, result }) => {
      const store = stores.get(visit.storeId);
      return {
        visitId: visit.id,
        storeId: visit.storeId,
        chain: store?.chain ?? null,
        area: store?.area ?? null,
        createdAt: visit.createdAt,
        submittedAt: visit.submittedAt,
        completedAt: visit.completedAt,
        dataUse: visit.dataUse,
        analysis: {
          resultId: result.id,
          jobId: result.jobId,
          source: result.response.source,
          provider: result.response.provider,
          methodVersion: result.response.methodVersion,
          catalogueVersion: result.response.catalogueVersion,
          analysedAt: result.response.analysedAt,
          status: result.response.status,
        },
      };
    }),
  );
  await writeJson(PACKAGE_FILES.images, imageMeta);
  await writeJson(PACKAGE_FILES.draftLabels, coco);
  await writeJson(PACKAGE_FILES.corrections, corrections);

  const manifest = buildManifest({
    exportedAt,
    app: deps.app,
    scope,
    catalogueVersions: exportVisits.map((v) => v.result.response.catalogueVersion),
    methodVersions: exportVisits.map((v) => v.result.response.methodVersion),
    sources: exportVisits.map((v) => v.result.response.source),
    visitIds: exportVisits.map((v) => v.visit.id),
    stats,
    imagesSkipped: skipped,
    imagesReencoded: reencoded,
    files: [...files],
  });
  const manifestBytes = encoder.encode(`${JSON.stringify(manifest, null, 2)}\n`);
  const manifestEntry = new ZipDeflate(PACKAGE_FILES.manifest, { level: 6 });
  zip.add(manifestEntry);
  manifestEntry.push(manifestBytes, true);
  zip.end();
  if (zipError) throw zipError;

  collapse();
  const suffix = scope.kind === 'visit' ? scope.visitId : 'all';
  return {
    blob: new Blob(chunks, { type: 'application/zip' }),
    fileName: `shelfwise-training-${stamp(now)}-${suffix}.zip`,
    manifest,
  };
}
