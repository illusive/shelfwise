/** Pure guide logic: overlap target, hints, smoothing and tilt. */

export interface GuideConfig {
  /** Target overlap with the previous photo (fraction of the view width). */
  target: number;
  /** Accepted deviation either side of the target. */
  tolerance: number;
  /** Below this confidence the estimate is not shown (strip only). */
  minConfidence: number;
}

export const DEFAULT_GUIDE: GuideConfig = { target: 0.25, tolerance: 0.07, minConfidence: 0.35 };

export type GuideStatus = 'aligned' | 'move-right' | 'move-left' | 'searching';

export function guideStatus(
  overlap: number | null,
  confidence: number,
  config: GuideConfig = DEFAULT_GUIDE,
): GuideStatus {
  if (overlap === null || confidence < config.minConfidence) return 'searching';
  if (overlap > config.target + config.tolerance) return 'move-right'; // too much overlap
  if (overlap < config.target - config.tolerance) return 'move-left'; // gap risk
  return 'aligned';
}

/**
 * Exponential smoothing of the overlap estimate. Low-confidence readings are ignored, and
 * readings taken while the phone is rotating (large tilt change) count for less.
 */
export function smoothOverlap(
  previous: number | null,
  next: number,
  confidence: number,
  tiltChangeDeg: number | null,
  config: GuideConfig = DEFAULT_GUIDE,
): number | null {
  if (confidence < config.minConfidence) return previous;
  if (previous === null) return next;
  const steady = tiltChangeDeg === null || tiltChangeDeg < 2 ? 1 : tiltChangeDeg < 6 ? 0.5 : 0.2;
  const alpha = 0.55 * Math.min(1, confidence + 0.2) * steady;
  return previous + (next - previous) * alpha;
}

/** Roll (sideways tilt) of an upright phone from gravity in device coordinates, in degrees. */
export function rollFromGravity(x: number, y: number): number | null {
  if (!Number.isFinite(x) || !Number.isFinite(y) || Math.hypot(x, y) < 3) return null;
  return (Math.atan2(x, -y) * 180) / Math.PI;
}

/** Low-pass filter for sensor angles. */
export function lowPass(previous: number | null, next: number, alpha = 0.25): number {
  return previous === null ? next : previous + (next - previous) * alpha;
}

export const LEVEL_TOLERANCE_DEG = 2.5;

export function isLevel(rollDeg: number | null): boolean {
  return rollDeg !== null && Math.abs(rollDeg) <= LEVEL_TOLERANCE_DEG;
}

/** A capture sequence breaks when the rep pauses for this long between photos. */
export const RUN_GAP_MS = 2 * 60 * 1000;

export interface RunState {
  run: number;
  position: number;
  lastAt: number;
}

/** Position of the next photo in the left-to-right run (new run after a gap or on request). */
export function nextPlacement(
  state: RunState | null,
  now: number,
  previousRun: number,
  forceNew = false,
): RunState {
  if (!state || forceNew || now - state.lastAt > RUN_GAP_MS) {
    return { run: Math.max(previousRun, state?.run ?? 0) + 1, position: 1, lastAt: now };
  }
  return { run: state.run, position: state.position + 1, lastAt: now };
}
