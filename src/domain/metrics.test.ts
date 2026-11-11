import { describe, expect, it } from 'vitest';
import { analysisResponseSchema } from '@/contracts/analysis';
import { seedCatalogue } from '@/services/seed/catalogue';
import { facing, matched, response, unknown } from '@/test/fixtures';
import { indexCatalogue } from './catalogue';
import { compareSos } from './comparison';
import type { Correction } from './corrections';
import { computeVisitMetrics } from './metrics';

const catalogue = indexCatalogue(seedCatalogue);

function visit() {
  return response({
    facings: [
      facing('loc-shelf', 'img-1', matched('royal-pilsner-6x330'), 'p1'),
      facing('loc-shelf', 'img-2', matched('royal-pilsner-6x330'), 'p1'),
      facing('loc-shelf', 'img-2', matched('carlsberg-pilsner-6x330'), 'p2'),
      facing('loc-shelf', 'img-2', unknown('beer'), 'p3'),
      facing('loc-cooler', 'img-3', matched('pepsi-max-330'), 'c1'),
      facing('loc-cooler', 'img-3', matched('coca-cola-330'), 'c2'),
    ],
  });
}

describe('computeVisitMetrics', () => {
  it('computes shelf and cooler separately and aggregates counts for overall', () => {
    const m = computeVisitMetrics(visit(), [], catalogue);
    expect(m.scopes.shelf.sos.counts).toEqual({ client: 1, competitor: 1, unknown: 1, eligible: 3 });
    expect(m.scopes.cooler.sos.sharePct).toBe(50);
    // 2 of 5 counted facings, not the average of 33.3% and 50%.
    expect(m.scopes.overall.sos.sharePct).toBe(40);
    expect(m.coverage.duplicatesMerged).toBe(1);
  });

  it('counts licensed brands as client', () => {
    const m = computeVisitMetrics(visit(), [], catalogue);
    expect(m.clientProducts.map((p) => p.productId)).toEqual(['royal-pilsner-6x330', 'pepsi-max-330']);
    expect(m.uniqueClientSkus).toBe(2);
  });

  it('excludes display facings from Share of Shelf and counts displays', () => {
    const base = visit();
    const res = response({
      ...base,
      images: [...base.images, { imageId: 'img-4', usable: true, locationType: 'display', locationId: 'loc-d', issues: [] }],
      locations: [...base.locations, { locationId: 'loc-d', type: 'display', label: 'Display 1', imageIds: ['img-4'] }],
      facings: [...base.facings, facing('loc-d', 'img-4', matched('royal-classic-6x330'), 'd1')],
      displays: [{ displayId: 'd', imageId: 'img-4', locationId: 'loc-d', region: null, brandIds: ['royal'], description: 'Floor' }],
    });
    const m = computeVisitMetrics(res, [], catalogue);
    expect(m.scopes.overall.sos.counts.eligible).toBe(5);
    expect(m.displays).toMatchObject({ count: 1, withClientBrand: 1 });
  });

  it('recalculates with rep corrections and records provenance', () => {
    const res = visit();
    const unknownKey = 'loc-shelf::p3';
    const correction: Correction = {
      id: 'c',
      resultId: 'r',
      visitId: 'v',
      repId: 'rep',
      createdAt: '2026-11-10T10:00:00Z',
      targetKind: 'facing',
      targetId: unknownKey,
      value: { kind: 'product', productId: 'albani-odense-6x330' },
    };
    const before = computeVisitMetrics(res, [], catalogue);
    const after = computeVisitMetrics(res, [correction], catalogue);
    expect(before.unresolved.facings).toBe(1);
    expect(after.unresolved.facings).toBe(0);
    expect(after.scopes.shelf.sos.counts.client).toBe(2);
    expect(after.provenance.correctedFacings).toBe(1);
  });

  it('removes facings marked as not a beverage from the denominator', () => {
    const correction: Correction = {
      id: 'c',
      resultId: 'r',
      visitId: 'v',
      repId: 'rep',
      createdAt: '2026-11-10T10:00:00Z',
      targetKind: 'facing',
      targetId: 'loc-shelf::p3',
      value: { kind: 'not-beverage' },
    };
    const m = computeVisitMetrics(visit(), [correction], catalogue);
    expect(m.scopes.shelf.sos.counts.eligible).toBe(2);
  });
});

describe('compareSos', () => {
  it('reports percentage-point change for comparable visits', () => {
    const prev = computeVisitMetrics(visit(), [], catalogue);
    const cur = computeVisitMetrics(
      visit(),
      [
        {
          id: 'c',
          resultId: 'r',
          visitId: 'v',
          repId: 'rep',
          createdAt: '2026-11-10T10:00:00Z',
          targetKind: 'facing',
          targetId: 'loc-cooler::c2',
          value: { kind: 'product', productId: 'pepsi-330' },
        },
      ],
      catalogue,
    );
    const c = compareSos(cur, prev, 'cooler');
    expect(c).toMatchObject({ status: 'comparable', deltaPp: 50 });
  });

  it('qualifies comparisons with different coverage', () => {
    const prev = computeVisitMetrics(visit(), [], catalogue);
    const base = visit();
    const wider = response({
      ...base,
      locations: [...base.locations, { locationId: 'loc-shelf-2', type: 'shelf', label: 'Shelf 2', imageIds: ['img-1'] }],
    });
    const cur = computeVisitMetrics(wider, [], catalogue);
    expect(compareSos(cur, prev, 'shelf').reasons).toContain('coverage-differs');
  });

  it('does not compare different methods', () => {
    const prev = { ...computeVisitMetrics(visit(), [], catalogue), methodVersion: 'other' };
    const cur = computeVisitMetrics(visit(), [], catalogue);
    expect(compareSos(cur, prev, 'shelf')).toMatchObject({ status: 'not-comparable', deltaPp: null });
  });

  it('handles a first visit', () => {
    expect(compareSos(computeVisitMetrics(visit(), [], catalogue), null, 'shelf').status).toBe('no-previous');
  });
});

describe('analysisResponseSchema', () => {
  it('accepts a valid response', () => {
    expect(analysisResponseSchema.safeParse(visit()).success).toBe(true);
  });

  it('rejects references to unknown images', () => {
    const res = visit();
    res.facings.push(facing('loc-shelf', 'img-missing', matched('pepsi-330')));
    expect(analysisResponseSchema.safeParse(res).success).toBe(false);
  });

  it('rejects matched observations without a product or brand', () => {
    const res = visit();
    res.facings[0].match = { status: 'matched', productId: null, brandId: null, category: null, providerScore: 1 };
    expect(analysisResponseSchema.safeParse(res).success).toBe(false);
  });

  it('rejects unresolved labels without a reason and failures without detail', () => {
    expect(analysisResponseSchema.safeParse({ ...visit(), status: 'failed' }).success).toBe(false);
  });

  it('rejects regions outside the image', () => {
    const res = visit();
    res.facings[0].region = { x: 0.9, y: 0.1, width: 0.5, height: 0.1 };
    expect(analysisResponseSchema.safeParse(res).success).toBe(false);
  });
});
