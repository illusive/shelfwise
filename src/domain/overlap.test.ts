import { describe, expect, it } from 'vitest';
import { facing, matched, response, unknown } from '@/test/fixtures';
import { reconcileFacings } from './overlap';

const { locations } = response();

describe('reconcileFacings', () => {
  it('counts a physical position seen in two overlapping photos once', () => {
    const result = reconcileFacings(
      [
        facing('loc-shelf', 'img-1', matched('pepsi-330'), 'p1'),
        facing('loc-shelf', 'img-2', matched('pepsi-330'), 'p1'),
        facing('loc-shelf', 'img-2', matched('pepsi-330'), 'p2'),
      ],
      locations,
    );
    expect(result.facings).toHaveLength(2);
    expect(result.duplicatesMerged).toBe(1);
    expect(result.facings[0].evidence.map((e) => e.imageId)).toEqual(['img-1', 'img-2']);
  });

  it('preserves genuinely separate placements of the same product', () => {
    const result = reconcileFacings(
      [
        facing('loc-shelf', 'img-1', matched('pepsi-330'), 'p1'),
        facing('loc-cooler', 'img-3', matched('pepsi-330'), 'p1'),
      ],
      locations,
    );
    expect(result.facings).toHaveLength(2);
    expect(result.duplicatesMerged).toBe(0);
  });

  it('prefers a clear identification over an unclear view', () => {
    const result = reconcileFacings(
      [
        facing('loc-shelf', 'img-1', unknown('soft-drinks'), 'p1'),
        facing('loc-shelf', 'img-2', matched('pepsi-330'), 'p1'),
      ],
      locations,
    );
    expect(result.facings[0].match.productId).toBe('pepsi-330');
    expect(result.facings[0].conflict).toBe(false);
  });

  it('treats disagreeing identifications as an unknown conflict', () => {
    const result = reconcileFacings(
      [
        facing('loc-shelf', 'img-1', matched('pepsi-330'), 'p1'),
        facing('loc-shelf', 'img-2', matched('coca-cola-330'), 'p1'),
      ],
      locations,
    );
    expect(result.facings[0]).toMatchObject({ conflict: true, match: { status: 'unknown' } });
  });

  it('flags multi-image locations with unreconciled observations', () => {
    const result = reconcileFacings(
      [
        facing('loc-shelf', 'img-1', matched('pepsi-330'), null),
        facing('loc-shelf', 'img-2', matched('pepsi-330'), null),
        facing('loc-cooler', 'img-3', matched('pepsi-330'), null),
      ],
      locations,
    );
    expect(result.facings).toHaveLength(3);
    expect(result.unreconciledLocationIds).toEqual(['loc-shelf']);
  });
});
