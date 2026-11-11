import Dexie, { type Table } from 'dexie';
import type { Correction } from '@/domain/corrections';
import type { AnalysisJob, Capture, Rep, Store, StoredResult, Visit } from '@/domain/models';

export interface StoredBlob {
  id: string;
  blob: Blob;
}

export interface MetaEntry {
  key: string;
  value: unknown;
}

/** IndexedDB schema. Bump the version and add an upgrade step for any index change. */
export class ShelfwiseDb extends Dexie {
  reps!: Table<Rep, string>;
  stores!: Table<Store, string>;
  visits!: Table<Visit, string>;
  captures!: Table<Capture, string>;
  blobs!: Table<StoredBlob, string>;
  jobs!: Table<AnalysisJob, string>;
  results!: Table<StoredResult, string>;
  corrections!: Table<Correction, string>;
  meta!: Table<MetaEntry, string>;

  constructor(name = 'shelfwise') {
    super(name);
    this.version(1).stores({
      reps: 'id',
      stores: 'id, chain, *assignedRepIds',
      visits: 'id, storeId, repId, status, createdAt, [storeId+repId+status]',
      captures: 'id, visitId',
      blobs: 'id',
      jobs: 'id, visitId, status',
      results: 'id, visitId',
      corrections: 'id, resultId',
      meta: 'key',
    });
  }
}
