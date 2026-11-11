import type { Catalogue } from '@/domain/catalogue';
import type { Correction } from '@/domain/corrections';
import type {
  AnalysisJob,
  Capture,
  PlannedVisit,
  Rep,
  Store,
  StoredResult,
  Visit,
} from '@/domain/models';

/**
 * Persistence boundary. Features depend on these interfaces only, so the IndexedDB
 * implementation can later be replaced by an API client.
 */
export interface Repositories {
  reps: {
    list(): Promise<Rep[]>;
    get(id: string): Promise<Rep | undefined>;
  };
  session: {
    getCurrentRepId(): Promise<string | null>;
    setCurrentRepId(id: string | null): Promise<void>;
  };
  stores: {
    list(): Promise<Store[]>;
    get(id: string): Promise<Store | undefined>;
  };
  plannedVisits: {
    /** Inclusive date range (YYYY-MM-DD), ordered by date then route order. */
    listForRep(repId: string, from: string, to: string): Promise<PlannedVisit[]>;
  };
  catalogue: {
    get(): Catalogue;
  };
  visits: {
    get(id: string): Promise<Visit | undefined>;
    list(filter?: { repId?: string; storeId?: string }): Promise<Visit[]>;
    findDraft(storeId: string, repId: string): Promise<Visit | undefined>;
    put(visit: Visit): Promise<void>;
    update(id: string, changes: Partial<Visit>): Promise<void>;
    /**
     * Atomically returns the visit's job, creating it only if none exists, so repeated taps
     * or retried requests never create duplicate jobs.
     */
    attachJob(visitId: string, create: (visit: Visit) => AnalysisJob): Promise<AnalysisJob>;
    /**
     * Atomically stores the result and completes visit + job, only if the visit is still
     * submitted with this job and the job was not cancelled. Returns false otherwise.
     */
    completeJob(input: {
      jobId: string;
      result: StoredResult;
      completedAt: string;
      updatedAt: string;
    }): Promise<boolean>;
    delete(id: string): Promise<void>;
    /**
     * Atomically cancels a submitted visit's unfinished job and reopens it as a draft with a
     * new idempotency key. No-op for drafts and completed visits.
     */
    reopen(visitId: string, idempotencyKey: string, at: string): Promise<void>;
  };
  captures: {
    get(id: string): Promise<Capture | undefined>;
    listByVisit(visitId: string): Promise<Capture[]>;
    put(capture: Capture): Promise<void>;
    delete(id: string): Promise<void>;
  };
  jobs: {
    get(id: string): Promise<AnalysisJob | undefined>;
    listActive(): Promise<AnalysisJob[]>;
    put(job: AnalysisJob): Promise<void>;
    /** Read-modify-write; never overrides a cancelled job. Returns the stored job. */
    update(id: string, changes: Partial<AnalysisJob>): Promise<AnalysisJob | undefined>;
  };
  results: {
    get(id: string): Promise<StoredResult | undefined>;
    put(result: StoredResult): Promise<void>;
  };
  corrections: {
    listByResult(resultId: string): Promise<Correction[]>;
    add(correction: Correction): Promise<void>;
  };
}

export interface BlobStore {
  get(id: string): Promise<Blob | undefined>;
  put(id: string, blob: Blob): Promise<void>;
  delete(id: string): Promise<void>;
}
