/** Normalised (0–1) box in video-frame coordinates. */
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
  score: number;
}

export interface Track {
  id: number;
  box: Box;
  /** Consecutive frames this track was matched. */
  hits: number;
  /** Consecutive frames it went unmatched. */
  misses: number;
}

export interface TrackerOptions {
  /** EMA weight of the new detection (0–1); lower = smoother, slower. */
  alpha: number;
  /** Minimum IoU to treat a detection as the same object. */
  minIou: number;
  /** Frames a lost track lingers before it is dropped (avoids flicker). */
  maxMisses: number;
  /** Frames a new track must be seen before it is shown (avoids pop-in noise). */
  minHits: number;
}

export const DEFAULT_TRACKER: TrackerOptions = {
  alpha: 0.45,
  minIou: 0.3,
  maxMisses: 2,
  minHits: 2,
};

export function iou(a: Box, b: Box): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = a.width * a.height + b.width * b.height - inter;
  return union <= 0 ? 0 : inter / union;
}

function blend(prev: Box, next: Box, alpha: number): Box {
  const mix = (p: number, n: number) => p + (n - p) * alpha;
  return {
    x: mix(prev.x, next.x),
    y: mix(prev.y, next.y),
    width: mix(prev.width, next.width),
    height: mix(prev.height, next.height),
    score: next.score,
  };
}

/**
 * Greedy IoU matching of detections to existing tracks, with exponential smoothing of
 * matched boxes. Unmatched detections start new tracks; unmatched tracks age out.
 */
export function updateTracks(
  tracks: readonly Track[],
  detections: readonly Box[],
  nextId: () => number,
  options: TrackerOptions = DEFAULT_TRACKER,
): Track[] {
  const pairs: { t: number; d: number; overlap: number }[] = [];
  tracks.forEach((track, t) =>
    detections.forEach((det, d) => {
      const overlap = iou(track.box, det);
      if (overlap >= options.minIou) pairs.push({ t, d, overlap });
    }),
  );
  pairs.sort((a, b) => b.overlap - a.overlap);

  const usedTracks = new Set<number>();
  const usedDetections = new Set<number>();
  const next: Track[] = [];
  for (const { t, d } of pairs) {
    if (usedTracks.has(t) || usedDetections.has(d)) continue;
    usedTracks.add(t);
    usedDetections.add(d);
    const track = tracks[t];
    next.push({
      ...track,
      box: blend(track.box, detections[d], options.alpha),
      hits: track.hits + 1,
      misses: 0,
    });
  }
  tracks.forEach((track, t) => {
    if (usedTracks.has(t)) return;
    if (track.misses + 1 <= options.maxMisses)
      next.push({ ...track, hits: 0, misses: track.misses + 1 });
  });
  detections.forEach((det, d) => {
    if (!usedDetections.has(d)) next.push({ id: nextId(), box: det, hits: 1, misses: 0 });
  });
  return next;
}

/** Tracks stable enough to draw: confirmed once, and still within the linger window. */
export function visibleTracks(
  tracks: readonly Track[],
  options: TrackerOptions = DEFAULT_TRACKER,
): Track[] {
  return tracks.filter((t) => t.misses > 0 || t.hits >= options.minHits);
}

export interface GovernorOptions {
  /** Minimum time between inference runs (ms); ~125 ms ≈ 8 fps. */
  intervalMs: number;
  /** Average inference time above which detection is switched off as too slow. */
  slowMs: number;
  /** Samples averaged before deciding (the first, warm-up run is ignored). */
  window: number;
}

export const DEFAULT_GOVERNOR: GovernorOptions = { intervalMs: 125, slowMs: 300, window: 8 };

/** Throttles inference, skips frames while busy, and detects devices that are too slow. */
export class InferenceGovernor {
  private lastStart = -Infinity;
  private samples: number[] = [];
  private seen = 0;
  busy = false;

  constructor(private readonly options: GovernorOptions = DEFAULT_GOVERNOR) {}

  shouldRun(now: number): boolean {
    return !this.busy && now - this.lastStart >= this.options.intervalMs;
  }

  start(now: number): void {
    this.busy = true;
    this.lastStart = now;
  }

  finish(durationMs: number): void {
    this.busy = false;
    this.seen += 1;
    if (this.seen === 1) return; // warm-up (shader/graph compilation)
    this.samples.push(durationMs);
    if (this.samples.length > this.options.window) this.samples.shift();
  }

  get averageMs(): number | null {
    return this.samples.length
      ? this.samples.reduce((a, b) => a + b, 0) / this.samples.length
      : null;
  }

  get tooSlow(): boolean {
    return (
      this.samples.length >= this.options.window && (this.averageMs ?? 0) > this.options.slowMs
    );
  }
}

/** Maps a normalised frame box onto an element showing the video with `object-fit: cover`. */
export function coverTransform(
  box: Box,
  video: { width: number; height: number },
  view: { width: number; height: number },
): { left: number; top: number; width: number; height: number } {
  const scale = Math.max(view.width / video.width, view.height / video.height);
  const offsetX = (view.width - video.width * scale) / 2;
  const offsetY = (view.height - video.height * scale) / 2;
  return {
    left: offsetX + box.x * video.width * scale,
    top: offsetY + box.y * video.height * scale,
    width: box.width * video.width * scale,
    height: box.height * video.height * scale,
  };
}

/** True when at least half of the box is inside the visible (cropped) preview. */
export function isInView(
  box: Box,
  video: { width: number; height: number },
  view: { width: number; height: number },
): boolean {
  const r = coverTransform(box, video, view);
  const w = Math.max(0, Math.min(r.left + r.width, view.width) - Math.max(r.left, 0));
  const h = Math.max(0, Math.min(r.top + r.height, view.height) - Math.max(r.top, 0));
  return r.width * r.height > 0 && (w * h) / (r.width * r.height) >= 0.5;
}
