import { describe, expect, it } from 'vitest';
import {
  formatAddress,
  formatDkk,
  formatPack,
  formatPp,
  formatRelativeDay,
  localDateKey,
  parseDkkInput,
} from './format';
import { setLanguage } from './language';
import { dictionaries } from './strings';

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

  it('formats Danish addresses with an optional floor', () => {
    expect(
      formatAddress({
        street: 'Vesterbrogade 12',
        floor: '1. sal',
        postcode: '1620',
        city: 'København V',
      }),
    ).toBe('Vesterbrogade 12, 1. sal, 1620 København V');
    expect(
      formatAddress({ street: 'Nørrebrogade 34', postcode: '2200', city: 'København N' }),
    ).toBe('Nørrebrogade 34, 2200 København N');
  });

  it('uses Danish words and packs when Danish is selected', () => {
    setLanguage('da');
    expect(
      formatRelativeDay(
        '2026-11-10T12:00:00Z',
        'Europe/Copenhagen',
        new Date('2026-11-10T13:00:00Z'),
      ),
    ).toBe('I dag');
    expect(formatPack({ units: 6, volumeMl: 330, container: 'can' })).toBe('6 × 330 ml dåser');
  });
});

describe('dictionaries', () => {
  it('have the same keys in Danish and English', () => {
    const keys = (o: object, prefix = ''): string[] =>
      Object.entries(o).flatMap(([k, v]) =>
        v && typeof v === 'object' && !Array.isArray(v)
          ? keys(v, `${prefix}${k}.`)
          : [`${prefix}${k}`],
      );
    expect(keys(dictionaries.da).sort()).toEqual(keys(dictionaries.en).sort());
  });
});
