import { describe, expect, it } from 'vitest';
import { seedCatalogue } from '@/services/seed/catalogue';
import { label, matched, unknown } from '@/test/fixtures';
import { indexCatalogue } from './catalogue';
import type { PriceCorrection } from './corrections';
import { dedupeLabels, normalisePrice, normalisePrices } from './pricing';

const catalogue = indexCatalogue(seedCatalogue);

describe('normalisePrice', () => {
  it('keeps pant separate when it is added on top', () => {
    const p = normalisePrice(label({ amountOre: 895 }), catalogue);
    expect(p).toMatchObject({ basis: 'ex-deposit', basePriceOre: 895, displayedOre: 895 });
    expect(p.deposit.amountOre).toBe(100);
  });

  it('subtracts a known included deposit', () => {
    const p = normalisePrice(
      label({ amountOre: 995, deposit: { shown: true, amountOre: 100, included: true } }),
      catalogue,
    );
    expect(p).toMatchObject({ basis: 'ex-deposit', basePriceOre: 895 });
  });

  it('does not guess when the deposit treatment is unknown', () => {
    const p = normalisePrice(
      label({ deposit: { shown: false, amountOre: null, included: null } }),
      catalogue,
    );
    expect(p.basis).toBe('as-displayed');
  });

  it('preserves the multibuy condition and derives a per-item price', () => {
    const p = normalisePrice(
      label({ priceType: 'promotion', multibuy: { quantity: 3, totalOre: 3000 } }),
      catalogue,
    );
    expect(p.multibuy).toEqual({ quantity: 3, totalOre: 3000, perItemOre: 1000 });
    expect(p.displayedOre).toBe(895);
  });

  it('computes price per litre only with a known pack', () => {
    const withCatalogue = normalisePrice(
      label({ amountOre: 6495, match: matched('royal-pilsner-6x330') }),
      catalogue,
    );
    expect(withCatalogue.packSource).toBe('catalogue');
    expect(withCatalogue.pricePerLitreOre).toBe(Math.round(6495 / 1.98));

    const noPack = normalisePrice(label({ match: unknown('soft-drinks') }), catalogue);
    expect(noPack.pack).toBeNull();
    expect(noPack.pricePerLitreOre).toBeNull();
  });

  it('never makes different pack sizes comparable', () => {
    const single = normalisePrice(label({ match: matched('pepsi-max-330') }), catalogue);
    const bottle = normalisePrice(label({ match: matched('pepsi-max-1500') }), catalogue);
    expect(single.comparableKey).not.toEqual(bottle.comparableKey);
  });

  it('does not attach a candidate match to a product', () => {
    const p = normalisePrice(
      label({
        match: {
          status: 'candidate',
          productId: 'pepsi-330',
          brandId: null,
          category: null,
          providerScore: 0.4,
        },
      }),
      catalogue,
    );
    expect(p.productId).toBeNull();
    expect(p.classification).toBe('unknown');
  });

  it('flags unresolved labels for review until corrected', () => {
    const raw = label({ status: 'unresolved', unresolvedReason: 'unreadable', amountOre: null });
    expect(normalisePrice(raw, catalogue).needsReview).toBe(true);
    const correction: PriceCorrection = {
      id: 'c1',
      resultId: 'r',
      visitId: 'v',
      repId: 'rep',
      createdAt: '2026-11-10T10:00:00Z',
      targetKind: 'price-label',
      targetId: raw.labelId,
      value: { kind: 'price', amountOre: 1295, priceType: 'regular' },
    };
    const corrected = normalisePrice(raw, catalogue, correction);
    expect(corrected).toMatchObject({
      needsReview: false,
      source: 'rep',
      displayedOre: 1295,
      status: 'resolved',
    });
  });
});

describe('dedupeLabels', () => {
  it('lists a physical label seen in two photos once, preferring the readable view', () => {
    const a = label({
      physicalLabelId: 'pl-1',
      status: 'unresolved',
      unresolvedReason: 'unreadable',
      amountOre: null,
    });
    const b = label({ physicalLabelId: 'pl-1', imageId: 'img-2' });
    const result = dedupeLabels([a, b, label()]);
    expect(result).toHaveLength(2);
    expect(result.find((l) => l.physicalLabelId === 'pl-1')?.labelId).toBe(b.labelId);
  });

  it('applies the latest correction per label', () => {
    const raw = label({ status: 'unresolved', unresolvedReason: 'unreadable', amountOre: null });
    const base = {
      resultId: 'r',
      visitId: 'v',
      repId: 'rep',
      targetKind: 'price-label' as const,
      targetId: raw.labelId,
    };
    const prices = normalisePrices([raw], catalogue, [
      { ...base, id: 'c2', createdAt: '2026-11-10T10:05:00Z', value: { kind: 'unreadable' } },
      {
        ...base,
        id: 'c1',
        createdAt: '2026-11-10T10:00:00Z',
        value: { kind: 'price', amountOre: 1, priceType: 'regular' },
      },
    ]);
    expect(prices[0]).toMatchObject({ status: 'unresolved', source: 'rep', needsReview: false });
  });
});
