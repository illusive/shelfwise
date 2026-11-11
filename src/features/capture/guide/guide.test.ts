import { describe, expect, it } from 'vitest';
import { estimateOverlap, rightStrip, type GrayImage } from './alignment';
import {
  guideStatus,
  isLevel,
  lowPass,
  nextPlacement,
  rollFromGravity,
  RUN_GAP_MS,
  smoothOverlap,
} from './guide';

/** Deterministic textured "shelf" scene: random blocks of varying brightness. */
function scene(width: number, height: number, seed = 7, period = 0): GrayImage {
  let s = seed;
  const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  const data = new Float32Array(width * height);
  const blocks = Array.from({ length: Math.ceil(width / 6) * Math.ceil(height / 8) }, rnd);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const bx = period ? Math.floor((x % period) / 6) : Math.floor(x / 6);
      const v = period
        ? ((bx + Math.floor(y / 8)) % 2) * 0.6 + 0.2
        : blocks[Math.floor(y / 8) * Math.ceil(width / 6) + bx];
      data[y * width + x] = v;
    }
  }
  return { width, height, data };
}

function crop(image: GrayImage, x0: number, width: number, brightness = 0): GrayImage {
  const data = new Float32Array(width * image.height);
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < width; x++)
      data[y * width + x] = image.data[y * image.width + x0 + x] + brightness;
  }
  return { width, height: image.height, data };
}

const W = 96;
const H = 120;
const world = scene(400, H);
const previous = crop(world, 0, W);
const strip = rightStrip(previous, 0.25); // 24 px wide, previous cols 72–95

describe('estimateOverlap', () => {
  it.each([
    [72, 0.25],
    [40, (96 - 40) / 96],
    [84, (96 - 84) / 96],
  ])('finds the strip after moving %i px (overlap %f)', (shift, expected) => {
    const result = estimateOverlap(strip, crop(world, shift, W, 0.05));
    expect(result.overlap).toBeCloseTo(expected, 2);
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('reports low confidence on repetitive shelves', () => {
    const repetitive = scene(400, H, 1, 12);
    const r = estimateOverlap(rightStrip(crop(repetitive, 0, W), 0.25), crop(repetitive, 60, W));
    expect(r.confidence).toBeLessThan(0.35);
  });

  it('gives zero confidence for a featureless strip', () => {
    const flat: GrayImage = { width: W, height: H, data: new Float32Array(W * H).fill(0.5) };
    expect(estimateOverlap(rightStrip(flat, 0.25), crop(world, 50, W)).confidence).toBe(0);
  });
});

describe('guide logic', () => {
  it('maps overlap to hints around the target', () => {
    expect(guideStatus(0.25, 0.9)).toBe('aligned');
    expect(guideStatus(0.5, 0.9)).toBe('move-right');
    expect(guideStatus(0.1, 0.9)).toBe('move-left');
    expect(guideStatus(0.25, 0.2)).toBe('searching');
    expect(guideStatus(null, 1)).toBe('searching');
  });

  it('smooths estimates, ignores unsure ones and damps updates while tilting', () => {
    expect(smoothOverlap(null, 0.4, 0.9, null)).toBe(0.4);
    expect(smoothOverlap(0.4, 0.9, 0.1, null)).toBe(0.4);
    const steady = smoothOverlap(0.4, 0.2, 0.9, 0)!;
    const tilting = smoothOverlap(0.4, 0.2, 0.9, 10)!;
    expect(steady).toBeLessThan(0.4);
    expect(tilting).toBeGreaterThan(steady);
  });

  it('computes roll and level from gravity', () => {
    expect(rollFromGravity(0, -9.8)).toBeCloseTo(0);
    expect(
      rollFromGravity(9.8 * Math.sin(Math.PI / 18), -9.8 * Math.cos(Math.PI / 18)),
    ).toBeCloseTo(10);
    expect(rollFromGravity(0, 0.5)).toBeNull();
    expect(isLevel(1.5)).toBe(true);
    expect(isLevel(5)).toBe(false);
    expect(lowPass(0, 10, 0.25)).toBe(2.5);
  });

  it('numbers photos in runs and starts a new run after a pause or on request', () => {
    const a = nextPlacement(null, 0, 2);
    expect(a).toMatchObject({ run: 3, position: 1 });
    const b = nextPlacement(a, 10_000, 2);
    expect(b).toMatchObject({ run: 3, position: 2 });
    expect(nextPlacement(b, 10_000 + RUN_GAP_MS + 1, 2)).toMatchObject({ run: 4, position: 1 });
    expect(nextPlacement(b, 11_000, 2, true)).toMatchObject({ run: 4, position: 1 });
  });
});

describe('strip frames', () => {
  it('rejects unpainted (black) frames but keeps plain surfaces', async () => {
    const { isBlank } = await import('../vision/frames');
    const gray = (v: number) => ({ width: 4, height: 4, data: new Float32Array(16).fill(v) });
    expect(isBlank(gray(0))).toBe(true);
    expect(isBlank(gray(0.02))).toBe(true);
    expect(isBlank(gray(0.45))).toBe(false);
  });

  it('crops like object-fit: cover', async () => {
    const { coverCrop } = await import('../vision/frames');
    // 16:9 landscape video in a portrait view: only the centre band is visible.
    const crop = coverCrop(3840, 2160, 393, 481);
    expect(crop.sh).toBe(2160);
    expect(crop.sw).toBeCloseTo((2160 * 393) / 481, 5);
    expect(crop.sx).toBeCloseTo((3840 - crop.sw) / 2, 5);
    expect(crop.sy).toBe(0);
  });
});
