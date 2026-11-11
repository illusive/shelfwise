import type { VisitMetrics } from './metrics';
import type { SosScope } from './sos';

export type ComparisonStatus = 'comparable' | 'qualified' | 'not-comparable' | 'no-previous';
export type ComparisonReason =
  | 'method-changed'
  | 'measure-unavailable'
  | 'measure-qualified'
  | 'coverage-differs'
  | 'source-differs';

export interface SosComparison {
  status: ComparisonStatus;
  /** Percentage points, current minus previous. */
  deltaPp: number | null;
  previousPct: number | null;
  reasons: ComparisonReason[];
}

/** Usable photo counts outside this ratio are treated as different coverage. */
const COVERAGE_RATIO = 1.5;

export function roundPp(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Compares the same scope of two visits. Different methods or unavailable measures are never
 * compared; differing coverage or data source still shows a change, but qualified.
 */
export function compareSos(
  current: VisitMetrics,
  previous: VisitMetrics | null,
  scope: SosScope,
): SosComparison {
  if (!previous) return { status: 'no-previous', deltaPp: null, previousPct: null, reasons: [] };
  const cur = current.scopes[scope];
  const prev = previous.scopes[scope];
  const notComparable = (reason: ComparisonReason): SosComparison => ({
    status: 'not-comparable',
    deltaPp: null,
    previousPct: prev.sos.sharePct,
    reasons: [reason],
  });
  if (current.methodVersion !== previous.methodVersion) return notComparable('method-changed');
  if (cur.sos.sharePct === null || prev.sos.sharePct === null) return notComparable('measure-unavailable');

  const reasons: ComparisonReason[] = [];
  if (cur.sos.status === 'qualified' || prev.sos.status === 'qualified') reasons.push('measure-qualified');
  if (coverageDiffers(cur.coverage, prev.coverage)) reasons.push('coverage-differs');
  if (current.source !== previous.source) reasons.push('source-differs');

  return {
    status: reasons.length > 0 ? 'qualified' : 'comparable',
    deltaPp: roundPp(roundPp(cur.sos.sharePct) - roundPp(prev.sos.sharePct)),
    previousPct: prev.sos.sharePct,
    reasons,
  };
}

function coverageDiffers(
  a: { locations: number; usableImages: number },
  b: { locations: number; usableImages: number },
): boolean {
  if (a.locations !== b.locations) return true;
  const ratio = a.usableImages / Math.max(1, b.usableImages);
  return ratio > COVERAGE_RATIO || ratio < 1 / COVERAGE_RATIO;
}
