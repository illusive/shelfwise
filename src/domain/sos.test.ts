import { describe, expect, it } from 'vitest';
import { measureCategorySos, measureSos, type ClassifiedFacing } from './sos';

const f = (
  classification: ClassifiedFacing['classification'],
  category: ClassifiedFacing['category'] = 'beer',
) => ({
  classification,
  category,
});
const covered = { locations: 1, usableImages: 2, unreconciledOverlap: false };

describe('measureSos', () => {
  it('divides client facings by all eligible facings', () => {
    const facings = [f('client'), f('client'), f('competitor'), f('competitor')];
    const m = measureSos('shelf', facings, covered);
    expect(m.sharePct).toBe(50);
    expect(m.status).toBe('available');
    expect(m.counts).toEqual({ client: 2, competitor: 2, unknown: 0, eligible: 4 });
  });

  it('keeps unknown facings in the denominator', () => {
    const facings = [f('client'), f('competitor'), f('unknown'), f('unknown')];
    expect(measureSos('shelf', facings, covered).sharePct).toBe(25);
  });

  it('qualifies a result with a high unknown share', () => {
    const facings = [f('client'), f('unknown'), f('unknown'), f('competitor')];
    const m = measureSos('cooler', facings, covered);
    expect(m.status).toBe('qualified');
    expect(m.reasons).toContain('high-unknown-share');
  });

  it('qualifies a result when overlap was not reconciled', () => {
    const m = measureSos('shelf', [f('client')], { ...covered, unreconciledOverlap: true });
    expect(m.status).toBe('qualified');
    expect(m.reasons).toEqual(['overlap-unreconciled']);
  });

  it('is unavailable when the scope was not captured', () => {
    const m = measureSos('cooler', [], {
      locations: 0,
      usableImages: 0,
      unreconciledOverlap: false,
    });
    expect(m).toMatchObject({ status: 'unavailable', sharePct: null, reasons: ['not-captured'] });
  });

  it('is unavailable when no usable images exist', () => {
    const m = measureSos('shelf', [], {
      locations: 1,
      usableImages: 0,
      unreconciledOverlap: false,
    });
    expect(m.reasons).toEqual(['no-usable-images']);
  });

  it('is unavailable when no facings were detected', () => {
    expect(measureSos('shelf', [], covered).reasons).toEqual(['no-facings']);
  });
});

describe('measureCategorySos', () => {
  it('measures each category against its own facings', () => {
    const facings = [f('client', 'beer'), f('competitor', 'beer'), f('client', 'water')];
    const { categories, uncategorised } = measureCategorySos('shelf', facings, covered);
    expect(uncategorised).toBe(0);
    expect(categories.find((c) => c.category === 'beer')?.sharePct).toBe(50);
    expect(categories.find((c) => c.category === 'water')?.sharePct).toBe(100);
    expect(categories.find((c) => c.category === 'soft-drinks')).toBeUndefined();
  });

  it('qualifies categories when some facings have no category', () => {
    const facings = [f('client', 'beer'), f('unknown', null)];
    const { categories, uncategorised } = measureCategorySos('shelf', facings, covered);
    expect(uncategorised).toBe(1);
    expect(categories[0].status).toBe('qualified');
    expect(categories[0].reasons).toContain('uncategorised-facings');
  });
});
