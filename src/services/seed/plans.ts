import { weekOf } from '@/domain/dates';
import type { PlannedVisit, Rep, Store, VisitTag } from '@/domain/models';
import type { ShelfwiseDb } from '../db';

/** Reps cover stores in their region (by Danish postcode range). */
const REGION_POSTCODES: Record<string, [number, number]> = {
  Copenhagen: [1000, 2999],
  Aarhus: [8000, 8999],
  Odense: [5000, 5999],
};

const TAGS: VisitTag[] = ['campaign', 'upsell', 'display', 'new-listing'];

function hash(text: string): number {
  let h = 0;
  for (const ch of text) h = (Math.imul(31, h) + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

export function storePool(rep: Rep, stores: Store[]): Store[] {
  const [lo, hi] = REGION_POSTCODES[rep.region] ?? [0, 9999];
  const inRegion = stores.filter((s) => {
    const pc = Number(s.address.postcode);
    return pc >= lo && pc <= hi;
  });
  const assigned = inRegion.filter((s) => s.assignedRepIds.includes(rep.id));
  const others = inRegion.filter((s) => !s.assignedRepIds.includes(rep.id));
  return [...assigned, ...others];
}

/**
 * Deterministic demo route plan for one week: 4–6 visits on weekdays and 2 at weekends
 * (so the demo always has a plan), rotating through the rep's region.
 */
export function planWeek(rep: Rep, stores: Store[], anyDayInWeek: string): PlannedVisit[] {
  const pool = storePool(rep, stores);
  if (pool.length === 0) return [];
  return weekOf(anyDayInWeek).flatMap((date, day) => {
    const count = Math.min(pool.length, day < 5 ? 4 + (day % 3) : 2);
    return Array.from({ length: count }, (_, i) => {
      const store = pool[(day * 2 + i) % pool.length];
      const h = hash(`${store.id}:${date}`);
      const tags = TAGS.filter((_, t) => (h >> t) % 3 === 0).slice(0, 2);
      return {
        id: `plan-${rep.id}-${date}-${i + 1}`,
        repId: rep.id,
        storeId: store.id,
        date,
        order: i + 1,
        tags,
      };
    });
  });
}

/** Creates this week's plan for every rep that has none yet. Idempotent. */
export async function ensureWeekPlanned(db: ShelfwiseDb, today: string): Promise<void> {
  const week = weekOf(today);
  const [reps, stores] = await Promise.all([db.reps.toArray(), db.stores.toArray()]);
  for (const rep of reps) {
    const existing = await db.plannedVisits
      .where('[repId+date]')
      .between([rep.id, week[0]], [rep.id, week[6]], true, true)
      .count();
    if (existing === 0) await db.plannedVisits.bulkPut(planWeek(rep, stores, today));
  }
}
