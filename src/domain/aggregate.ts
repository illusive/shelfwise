import type { SosMeasure } from './sos';

/**
 * Share across several visits from their underlying counts (never an average of
 * percentages). Unavailable measures contribute nothing.
 */
export function aggregateShare(measures: readonly SosMeasure[]): { sharePct: number | null; client: number; eligible: number } {
  let client = 0;
  let eligible = 0;
  for (const m of measures) {
    if (m.status === 'unavailable') continue;
    client += m.counts.client;
    eligible += m.counts.eligible;
  }
  return { sharePct: eligible === 0 ? null : (client / eligible) * 100, client, eligible };
}

/** Keeps the most recent item per key; input must be sorted newest first. */
export function latestPerKey<T>(items: readonly T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const k = key(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
