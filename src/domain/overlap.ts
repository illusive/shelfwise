import type {
  AnalysisLocation,
  FacingObservation,
  LocationType,
  ProductMatch,
  Region,
} from '@/contracts/analysis';

export interface FacingEvidence {
  observationId: string;
  imageId: string;
  region: Region | null;
}

/** One physical product position after merging overlapping observations. */
export interface ReconciledFacing {
  key: string;
  locationId: string;
  locationType: LocationType;
  physicalPositionId: string | null;
  match: ProductMatch;
  /** Overlapping views disagreed on the product; treated as unknown. */
  conflict: boolean;
  evidence: FacingEvidence[];
}

export interface ReconcileResult {
  facings: ReconciledFacing[];
  observationCount: number;
  /** Observations folded into an already-counted physical position. */
  duplicatesMerged: number;
  /** Multi-image locations containing observations without a physical position id. */
  unreconciledLocationIds: string[];
}

export function facingKey(
  f: Pick<FacingObservation, 'locationId' | 'physicalPositionId' | 'facingId'>,
) {
  return `${f.locationId}::${f.physicalPositionId ?? `obs:${f.facingId}`}`;
}

/**
 * Counts each physical position once. Observations sharing a `physicalPositionId` within a
 * location are merged; observations without one are counted individually and the location is
 * flagged so the measure can be qualified instead of silently inflated.
 */
export function reconcileFacings(
  observations: readonly FacingObservation[],
  locations: readonly AnalysisLocation[],
): ReconcileResult {
  const locationById = new Map(locations.map((l) => [l.locationId, l]));
  const groups = new Map<string, FacingObservation[]>();
  const unreconciled = new Set<string>();

  for (const obs of observations) {
    const location = locationById.get(obs.locationId);
    if (!location) continue;
    if (obs.physicalPositionId === null && location.imageIds.length > 1) {
      unreconciled.add(obs.locationId);
    }
    const key = facingKey(obs);
    const group = groups.get(key);
    if (group) group.push(obs);
    else groups.set(key, [obs]);
  }

  const facings: ReconciledFacing[] = [];
  for (const [key, group] of groups) {
    const first = group[0];
    const location = locationById.get(first.locationId)!;
    const { match, conflict } = mergeMatches(group.map((g) => g.match));
    facings.push({
      key,
      locationId: first.locationId,
      locationType: location.type,
      physicalPositionId: first.physicalPositionId,
      match,
      conflict,
      evidence: group.map((g) => ({
        observationId: g.facingId,
        imageId: g.imageId,
        region: g.region,
      })),
    });
  }

  const counted = facings.reduce((n, f) => n + f.evidence.length, 0);
  return {
    facings,
    observationCount: counted,
    duplicatesMerged: counted - facings.length,
    unreconciledLocationIds: [...unreconciled],
  };
}

function identity(m: ProductMatch): string {
  return m.productId ?? `brand:${m.brandId}`;
}

function best(matches: ProductMatch[]): ProductMatch {
  return matches.reduce((a, b) => ((b.providerScore ?? 0) > (a.providerScore ?? 0) ? b : a));
}

/**
 * A clear identification beats an unclear view of the same position. Disagreeing
 * identifications are a conflict and fall back to unknown (stays in the denominator,
 * never credited to the client).
 */
export function mergeMatches(matches: ProductMatch[]): { match: ProductMatch; conflict: boolean } {
  for (const status of ['matched', 'candidate'] as const) {
    const subset = matches.filter((m) => m.status === status);
    if (subset.length === 0) continue;
    const ids = new Set(subset.map(identity));
    if (ids.size > 1) return { match: unknownMatch(matches), conflict: true };
    return { match: best(subset), conflict: false };
  }
  return { match: unknownMatch(matches), conflict: false };
}

function unknownMatch(matches: ProductMatch[]): ProductMatch {
  const categories = new Set(matches.map((m) => m.category).filter((c) => c !== null));
  return {
    status: 'unknown',
    productId: null,
    brandId: null,
    category: categories.size === 1 ? [...categories][0] : null,
    providerScore: null,
  };
}
