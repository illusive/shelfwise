import { describe, expect, it } from 'vitest';
import { weekOf } from '@/domain/dates';
import { seedReps, seedStores } from './people-and-stores';
import { planWeek, storePool } from './plans';

const alex = seedReps.find((r) => r.id === 'rep-alex')!;

describe('planWeek', () => {
  it('plans every day of the week in route order, deterministically', () => {
    const plans = planWeek(alex, seedStores, '2026-11-11');
    for (const day of weekOf('2026-11-11')) {
      const dayPlans = plans.filter((p) => p.date === day);
      expect(dayPlans.length).toBeGreaterThan(0);
      expect(dayPlans.map((p) => p.order)).toEqual(dayPlans.map((_, i) => i + 1));
      expect(new Set(dayPlans.map((p) => p.storeId)).size).toBe(dayPlans.length);
    }
    expect(planWeek(alex, seedStores, '2026-11-13')).toEqual(plans);
  });

  it("uses the rep's region, assigned stores first", () => {
    const pool = storePool(alex, seedStores);
    expect(pool.every((s) => Number(s.address.postcode) < 3000)).toBe(true);
    expect(pool[0].assignedRepIds).toContain('rep-alex');
  });
});
