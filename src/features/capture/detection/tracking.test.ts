import { describe, expect, it } from 'vitest';
import {
  coverTransform,
  InferenceGovernor,
  isInView,
  iou,
  updateTracks,
  visibleTracks,
  type Box,
  type Track,
} from './tracking';

const box = (x: number, y = 0.1, w = 0.1, h = 0.2): Box => ({
  x,
  y,
  width: w,
  height: h,
  score: 0.8,
});
const ids = () => {
  let n = 0;
  return () => ++n;
};

describe('updateTracks', () => {
  it('keeps one track per object and smooths its position', () => {
    const next = ids();
    let tracks: Track[] = updateTracks([], [box(0.1)], next);
    tracks = updateTracks(tracks, [box(0.12)], next);
    expect(tracks).toHaveLength(1);
    expect(tracks[0].id).toBe(1);
    // EMA (alpha 0.45): moves part of the way, not all the way.
    expect(tracks[0].box.x).toBeGreaterThan(0.1);
    expect(tracks[0].box.x).toBeLessThan(0.12);
  });

  it('only shows tracks seen twice, and lets lost tracks linger briefly', () => {
    const next = ids();
    let tracks = updateTracks([], [box(0.1)], next);
    expect(visibleTracks(tracks)).toHaveLength(0);
    tracks = updateTracks(tracks, [box(0.1)], next);
    expect(visibleTracks(tracks)).toHaveLength(1);
    tracks = updateTracks(tracks, [], next);
    tracks = updateTracks(tracks, [], next);
    expect(visibleTracks(tracks)).toHaveLength(1);
    tracks = updateTracks(tracks, [], next);
    expect(tracks).toHaveLength(0);
  });

  it('separates neighbouring bottles', () => {
    const next = ids();
    const tracks = updateTracks(
      updateTracks([], [box(0.1), box(0.3)], next),
      [box(0.31), box(0.11)],
      next,
    );
    expect(tracks.map((t) => t.id).sort()).toEqual([1, 2]);
    expect(iou(box(0.1), box(0.3))).toBe(0);
  });
});

describe('InferenceGovernor', () => {
  it('throttles and skips while busy', () => {
    const g = new InferenceGovernor({ intervalMs: 100, slowMs: 50, window: 2 });
    expect(g.shouldRun(0)).toBe(true);
    g.start(0);
    expect(g.shouldRun(200)).toBe(false); // busy
    g.finish(10);
    expect(g.shouldRun(50)).toBe(false); // too soon
    expect(g.shouldRun(100)).toBe(true);
  });

  it('flags slow devices after the warm-up run', () => {
    const g = new InferenceGovernor({ intervalMs: 0, slowMs: 50, window: 2 });
    for (const ms of [500, 80, 90]) {
      g.start(0);
      g.finish(ms);
    }
    expect(g.averageMs).toBe(85);
    expect(g.tooSlow).toBe(true);
  });
});

describe('isInView', () => {
  it('ignores boxes in the cropped-off part of the frame', () => {
    const video = { width: 400, height: 300 };
    const view = { width: 300, height: 450 };
    expect(isInView({ x: 0.45, y: 0.2, width: 0.1, height: 0.2, score: 1 }, video, view)).toBe(
      true,
    );
    expect(isInView({ x: 0.02, y: 0.2, width: 0.1, height: 0.2, score: 1 }, video, view)).toBe(
      false,
    );
  });
});

describe('coverTransform', () => {
  it('maps frame boxes through object-fit: cover cropping', () => {
    // 4:3 video in a tall 300x600 view: scaled ×1.5 by height, cropped 150px each side.
    const r = coverTransform(
      { x: 0.5, y: 0, width: 0.25, height: 0.5, score: 1 },
      { width: 400, height: 300 },
      { width: 300, height: 450 },
    );
    expect(r).toEqual({ left: 150, top: 0, width: 150, height: 225 });
  });
});
