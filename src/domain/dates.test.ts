import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, weekdayIndex, weekOf } from './dates';

describe('date keys', () => {
  it('computes weekdays and weeks (Monday first)', () => {
    expect(weekdayIndex('2026-11-11')).toBe(2); // Wednesday
    expect(weekOf('2026-11-11')).toEqual([
      '2026-11-09',
      '2026-11-10',
      '2026-11-11',
      '2026-11-12',
      '2026-11-13',
      '2026-11-14',
      '2026-11-15',
    ]);
  });

  it('adds days across months and counts days between', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(daysBetween('2026-10-18', '2026-11-11')).toBe(24);
  });
});
