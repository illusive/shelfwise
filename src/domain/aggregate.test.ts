import { describe, expect, it } from 'vitest';
import { aggregateShare, latestPerKey } from './aggregate';
import type { SosMeasure } from './sos';

const measure = (
  client: number,
  eligible: number,
  status: SosMeasure['status'] = 'available',
): SosMeasure => ({
  scope: 'overall',
  counts: { client, competitor: eligible - client, unknown: 0, eligible },
  sharePct: eligible ? (client / eligible) * 100 : null,
  status,
  reasons: [],
});

describe('aggregateShare', () => {
  it('sums counts instead of averaging percentages', () => {
    // 1/2 (50%) and 10/40 (25%) → 11/42, not 37.5%.
    expect(aggregateShare([measure(1, 2), measure(10, 40)]).sharePct).toBeCloseTo((11 / 42) * 100);
  });

  it('ignores unavailable measures and handles no data', () => {
    expect(aggregateShare([measure(0, 0, 'unavailable')]).sharePct).toBeNull();
  });
});

describe('latestPerKey', () => {
  it('keeps the first (newest) item per key', () => {
    expect(
      latestPerKey(
        [
          { k: 'a', v: 2 },
          { k: 'a', v: 1 },
          { k: 'b', v: 1 },
        ],
        (i) => i.k,
      ),
    ).toEqual([
      { k: 'a', v: 2 },
      { k: 'b', v: 1 },
    ]);
  });
});
