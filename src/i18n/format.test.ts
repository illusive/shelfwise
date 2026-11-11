import { describe, expect, it } from 'vitest';
import {
  formatDkk,
  formatPack,
  formatPp,
  formatRelativeDay,
  localDateKey,
  parseDkkInput,
} from './format';

describe('formatters', () => {
  it('formats DKK with Danish conventions', () => {
    expect(formatDkk(1295).replace(/\s/g, ' ')).toBe('12,95 kr.');
  });

  it('formats percentage-point changes with direction', () => {
    expect(formatPp(4)).toBe('↑ 4 pp');
    expect(formatPp(-2.5)).toBe('↓ 2,5 pp');
  });

  it('describes packs', () => {
    expect(formatPack({ units: 6, volumeMl: 330, container: 'can' })).toBe('6 × 330 ml cans');
    expect(formatPack({ units: 1, volumeMl: 1500, container: 'plastic-bottle' })).toBe(
      '1,5 l bottle',
    );
  });

  it('uses the store local date', () => {
    // 23:30 UTC on 9 Nov is already 10 Nov in Copenhagen.
    expect(localDateKey('2026-11-09T23:30:00Z', 'Europe/Copenhagen')).toBe('2026-11-10');
    expect(
      formatRelativeDay(
        '2026-11-09T23:30:00Z',
        'Europe/Copenhagen',
        new Date('2026-11-10T12:00:00Z'),
      ),
    ).toBe('Today');
  });

  it('parses price input', () => {
    expect(parseDkkInput('12,95')).toBe(1295);
    expect(parseDkkInput('12.5 kr.')).toBe(1250);
    expect(parseDkkInput('abc')).toBeNull();
  });
});
