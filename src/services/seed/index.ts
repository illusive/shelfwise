import type { ShelfwiseDb } from '../db';
import { seedReps, seedStores } from './people-and-stores';

export const SEED_VERSION = 1;
const SEED_KEY = 'seedVersion';

/** Idempotent: (re)seeds reps and stores when the seed version changes; never touches visits. */
export async function ensureSeeded(db: ShelfwiseDb): Promise<void> {
  const current = await db.meta.get(SEED_KEY);
  if (current?.value === SEED_VERSION) return;
  await db.transaction('rw', db.reps, db.stores, db.meta, async () => {
    await db.reps.bulkPut(seedReps);
    await db.stores.bulkPut(seedStores);
    await db.meta.put({ key: SEED_KEY, value: SEED_VERSION });
  });
}
