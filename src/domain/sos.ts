import { CATEGORIES, type Category } from './categories';
import type { FacingClass } from './corrections';

/** Agreed measure: visible facings. Changing the rules below requires a new version. */
export const SOS_METHOD_VERSION = 'sos-visible-facings-v1';

/** Above this unknown share a measure is shown as qualified. */
export const HIGH_UNKNOWN_SHARE = 0.25;

export type SosScope = 'shelf' | 'cooler' | 'overall';
export type SosStatus = 'available' | 'qualified' | 'unavailable';
export type SosReason =
  | 'not-captured'
  | 'no-usable-images'
  | 'no-facings'
  | 'overlap-unreconciled'
  | 'high-unknown-share'
  | 'uncategorised-facings';

export interface ClassifiedFacing {
  classification: FacingClass;
  category: Category | null;
}

export interface FacingCounts {
  client: number;
  competitor: number;
  unknown: number;
  /** client + competitor + unknown. Empty space is never a facing; displays are excluded upstream. */
  eligible: number;
}

export interface ScopeCoverage {
  locations: number;
  usableImages: number;
  unreconciledOverlap: boolean;
}

export interface SosMeasure {
  scope: SosScope;
  counts: FacingCounts;
  sharePct: number | null;
  status: SosStatus;
  reasons: SosReason[];
}

export interface CategorySos extends SosMeasure {
  category: Category;
}

export function countFacings(facings: readonly ClassifiedFacing[]): FacingCounts {
  const counts = { client: 0, competitor: 0, unknown: 0, eligible: 0 };
  for (const f of facings) {
    counts[f.classification] += 1;
    counts.eligible += 1;
  }
  return counts;
}

export function sharePercent(counts: FacingCounts): number | null {
  return counts.eligible === 0 ? null : (counts.client / counts.eligible) * 100;
}

export function combineCoverage(...parts: ScopeCoverage[]): ScopeCoverage {
  return {
    locations: parts.reduce((n, p) => n + p.locations, 0),
    usableImages: parts.reduce((n, p) => n + p.usableImages, 0),
    unreconciledOverlap: parts.some((p) => p.unreconciledOverlap),
  };
}

/**
 * Share of Shelf (%) = client facings ÷ eligible facings × 100. Unknown facings stay in the
 * denominator so unresolved detections can never inflate the client's share.
 */
export function measureSos(
  scope: SosScope,
  facings: readonly ClassifiedFacing[],
  coverage: ScopeCoverage,
): SosMeasure {
  const counts = countFacings(facings);
  const unavailable = (reason: SosReason): SosMeasure => ({
    scope,
    counts,
    sharePct: null,
    status: 'unavailable',
    reasons: [reason],
  });
  if (coverage.locations === 0) return unavailable('not-captured');
  if (coverage.usableImages === 0) return unavailable('no-usable-images');
  if (counts.eligible === 0) return unavailable('no-facings');

  const reasons: SosReason[] = [];
  if (coverage.unreconciledOverlap) reasons.push('overlap-unreconciled');
  if (counts.unknown / counts.eligible > HIGH_UNKNOWN_SHARE) reasons.push('high-unknown-share');
  return {
    scope,
    counts,
    sharePct: sharePercent(counts),
    status: reasons.length > 0 ? 'qualified' : 'available',
    reasons,
  };
}

/**
 * Per-category shares. Facings without a known category cannot be placed in any category,
 * so every category measure is qualified when such facings exist.
 */
export function measureCategorySos(
  scope: SosScope,
  facings: readonly ClassifiedFacing[],
  coverage: ScopeCoverage,
): { categories: CategorySos[]; uncategorised: number } {
  const uncategorised = facings.filter((f) => f.category === null).length;
  const categories: CategorySos[] = [];
  for (const category of CATEGORIES) {
    const subset = facings.filter((f) => f.category === category);
    if (subset.length === 0) continue;
    const measure = measureSos(scope, subset, coverage);
    if (uncategorised > 0 && measure.status !== 'unavailable') {
      measure.reasons.push('uncategorised-facings');
      measure.status = 'qualified';
    }
    categories.push({ ...measure, category });
  }
  return { categories, uncategorised };
}
