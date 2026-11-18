import { describe, expect, it } from 'vitest';
import { seedCatalogue } from '@/services/seed/catalogue';
import { indexCatalogue } from './catalogue';
import { createNameMatcher, parseUnits, parseVolumeMl } from './catalogueMatch';

const matcher = createNameMatcher(indexCatalogue(seedCatalogue));

describe('catalogue name matching', () => {
  it('reads pack sizes in Danish label notation', () => {
    expect(parseVolumeMl('33 cl dåse')).toBe(330);
    expect(parseVolumeMl('0,5 L PET')).toBe(500);
    expect(parseVolumeMl('1.5l')).toBe(1500);
    expect(parseVolumeMl('500ml')).toBe(500);
    expect(parseVolumeMl('Pepsi Max')).toBeNull();
    expect(parseUnits('6-pak 33 cl')).toBe(6);
    expect(parseUnits('6 x 33 cl')).toBe(6);
    expect(parseUnits('1 stk')).toBeNull();
  });

  it('matches brands on whole words, longest name first, ignoring accents and case', () => {
    expect(matcher.brandFor('FAXE KONDI BOOSTER 50 CL')).toBe('faxe-kondi-booster');
    expect(matcher.brandFor('faxe kondi')).toBe('faxe-kondi');
    expect(matcher.brandFor('Faxe Premium')).toBe('faxe');
    expect(matcher.brandFor('SCHIOTZ Mørk Mumme')).toBe('schiotz');
    expect(matcher.brandFor("Aqua d'Or kildevand")).toBe('aqua-dor');
    // "Sol" must not match inside "Solbær".
    expect(matcher.brandFor('Solbær saft')).toBeNull();
    expect(matcher.brandFor('Fever-Tree Tonic')).toBeNull();
  });
});
