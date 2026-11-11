import type { ShelfwiseDb } from '../db';
import { DEFAULT_REP_ID, seedReps, seedStores } from './people-and-stores';

export const SEED_VERSION = 1;
const SEED_KEY = 'seedVersion';
export const CURRENT_REP_KEY = 'currentRepId';

/** Idempotent: (re)seeds reps and stores when the seed version changes; never touches visits. */
export async function ensureSeeded(db: ShelfwiseDb): Promise<void> {
  const current = await db.meta.get(SEED_KEY);
  if (current?.value !== SEED_VERSION) {
    await db.transaction('rw', db.reps, db.stores, db.meta, async () => {
      await db.reps.bulkPut(seedReps);
      await db.stores.bulkPut(seedStores);
      await db.meta.put({ key: SEED_KEY, value: SEED_VERSION });
    });
  }
  await ensureCurrentRep(db);
}

/** The POC runs as one default rep; others can be chosen from the user drawer. */
export async function ensureCurrentRep(db: ShelfwiseDb): Promise<void> {
  const entry = await db.meta.get(CURRENT_REP_KEY);
  const id = typeof entry?.value === 'string' ? entry.value : null;
  if (id && (await db.reps.get(id))) return;
  await db.meta.put({ key: CURRENT_REP_KEY, value: DEFAULT_REP_ID });
}
