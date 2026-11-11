import type { Capture, CapturePlacement, CaptureSource, Visit } from '@/domain/models';
import { newId, nowIso } from './ids';
import type { ImageProcessor } from './images';
import type { BlobStore, Repositories } from './repositories';

export interface CaptureInput {
  blob: Blob;
  source: CaptureSource;
  capturedAt?: Date;
  placement?: CapturePlacement | null;
}

export class DraftLockedError extends Error {
  constructor() {
    super('This visit has been submitted and can no longer be edited.');
  }
}

export type CaptureService = ReturnType<typeof createCaptureService>;

export function createCaptureService(deps: {
  repos: Repositories;
  blobs: BlobStore;
  images: ImageProcessor;
  now?: () => Date;
}) {
  const { repos, blobs, images } = deps;
  const now = deps.now ?? (() => new Date());
  // Rapid shutter taps must get consecutive sequence numbers: serialise writes per visit.
  const queues = new Map<string, Promise<unknown>>();
  const enqueue = <T>(visitId: string, task: () => Promise<T>): Promise<T> => {
    const previous = queues.get(visitId) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(task);
    queues.set(visitId, next);
    return next;
  };

  async function editableVisit(visitId: string): Promise<Visit> {
    const visit = await repos.visits.get(visitId);
    if (!visit) throw new Error(`Visit ${visitId} not found`);
    if (visit.status !== 'draft') throw new DraftLockedError();
    return visit;
  }

  async function storeImage(input: CaptureInput) {
    const [{ width, height }, thumb] = await Promise.all([
      images.dimensions(input.blob),
      images.thumbnail(input.blob),
    ]);
    const blobId = newId('blob');
    await blobs.put(blobId, input.blob);
    let thumbBlobId: string | null = null;
    if (thumb) {
      thumbBlobId = newId('thumb');
      await blobs.put(thumbBlobId, thumb);
    }
    return {
      blobId,
      thumbBlobId,
      width,
      height,
      mimeType: input.blob.type || 'image/jpeg',
      byteSize: input.blob.size,
      capturedAt: (input.capturedAt ?? now()).toISOString(),
      source: input.source,
    };
  }

  async function deleteImages(capture: Capture) {
    await blobs.delete(capture.blobId);
    if (capture.thumbBlobId) await blobs.delete(capture.thumbBlobId);
  }

  async function touch(visitId: string) {
    await repos.visits.update(visitId, { updatedAt: nowIso(now) });
  }

  return {
    /** Resumes the rep's open draft for the store, or starts a new one. */
    async startVisit(storeId: string, repId: string): Promise<Visit> {
      const draft = await repos.visits.findDraft(storeId, repId);
      if (draft) return draft;
      const at = nowIso(now);
      const visit: Visit = {
        id: newId('visit'),
        storeId,
        repId,
        status: 'draft',
        idempotencyKey: newId('idem'),
        jobId: null,
        resultId: null,
        createdAt: at,
        updatedAt: at,
        submittedAt: null,
        completedAt: null,
      };
      await repos.visits.put(visit);
      return visit;
    },

    addCapture(visitId: string, input: CaptureInput): Promise<Capture> {
      return enqueue(visitId, async () => {
        await editableVisit(visitId);
        const existing = await repos.captures.listByVisit(visitId);
        const stored = await storeImage(input);
        const capture: Capture = {
          id: newId('cap'),
          visitId,
          sequence: (existing.at(-1)?.sequence ?? 0) + 1,
          ...stored,
          placement: input.placement ?? null,
        };
        await repos.captures.put(capture);
        await touch(visitId);
        return capture;
      });
    },

    /** Retake keeps the capture's position in the sequence. */
    async replaceCapture(captureId: string, input: CaptureInput): Promise<Capture> {
      const old = await repos.captures.get(captureId);
      if (!old) throw new Error(`Capture ${captureId} not found`);
      return enqueue(old.visitId, async () => {
        await editableVisit(old.visitId);
        const stored = await storeImage(input);
        const capture: Capture = { ...old, ...stored };
        await repos.captures.put(capture);
        await deleteImages(old);
        await touch(old.visitId);
        return capture;
      });
    },

    /**
     * Removes the capture from the visit but keeps its image blobs so the removal can be
     * undone with `restoreCapture`. Call `purgeRemoved` once undo is no longer offered; blobs
     * left behind by a closed app are cleaned up by `sweepOrphanBlobs` at start-up.
     */
    async removeCapture(captureId: string): Promise<Capture | undefined> {
      const capture = await repos.captures.get(captureId);
      if (!capture) return undefined;
      return enqueue(capture.visitId, async () => {
        await editableVisit(capture.visitId);
        await repos.captures.delete(captureId);
        await touch(capture.visitId);
        return capture;
      });
    },

    /** Puts a removed capture back in its original position (same sequence number). */
    async restoreCapture(capture: Capture): Promise<void> {
      await enqueue(capture.visitId, async () => {
        await editableVisit(capture.visitId);
        if (!(await blobs.get(capture.blobId))) throw new Error('Photo no longer available');
        const existing = await repos.captures.listByVisit(capture.visitId);
        // Keep the original number unless a newer photo took it while undo was pending.
        const taken = existing.some((c) => c.sequence === capture.sequence);
        const sequence = taken ? (existing.at(-1)?.sequence ?? 0) + 1 : capture.sequence;
        await repos.captures.put({ ...capture, sequence });
        await touch(capture.visitId);
      });
    },

    /** Deletes a removed capture's images unless it was restored in the meantime. */
    async purgeRemoved(capture: Capture): Promise<void> {
      if (await repos.captures.get(capture.id)) return;
      await deleteImages(capture);
    },

    /** Turns a failed submission back into an editable draft with a fresh idempotency key. */
    async reopenDraft(visitId: string): Promise<void> {
      await repos.visits.reopen(visitId, newId('idem'), nowIso(now));
    },

    /** Resolves once all queued capture writes for the visit have settled. */
    whenIdle(visitId: string): Promise<void> {
      return (queues.get(visitId) ?? Promise.resolve()).then(
        () => undefined,
        () => undefined,
      );
    },

    async discardDraft(visitId: string): Promise<void> {
      await editableVisit(visitId);
      await repos.visits.delete(visitId);
    },
  };
}
