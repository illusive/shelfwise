import type { Catalogue } from '@/domain/catalogue';
import type { Correction } from '@/domain/corrections';
import type { AnalysisJob, Capture, Rep, Store, StoredResult, Visit } from '@/domain/models';

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
    delete(id: string): Promise<void>;
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
