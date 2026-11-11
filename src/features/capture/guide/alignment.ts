/**
 * Framework-free overlap estimation between the right-edge strip of the previous photo and
 * the live frame. Both are small grayscale images of the *visible* viewfinder area, so all
 * results are fractions of the viewfinder width.
 *
 * Method: zero-mean normalised cross-correlation of the strip against every horizontal
 * position in the live frame (with a small vertical search for hand shake). Confidence
 * combines the peak correlation with its distinctiveness from the best *other* position —
 * repetitive shelves (rows of identical cans) produce several similar peaks and so low
 * confidence, which the UI reports honestly.
 */
export interface GrayImage {
  width: number;
  height: number;
  /** Row-major luminance, 0–1. */
  data: Float32Array;
}

export interface AlignResult {
  /** Estimated overlap of the previous photo with the live view, 0–1 of the view width. */
  overlap: number;
  /** 0–1 guidance confidence (not a validated accuracy). */
  confidence: number;
  /** Peak correlation (−1–1). */
  peak: number;
}

export interface AlignOptions {
  /** Vertical search in pixels (hand shake). */
  maxShiftY: number;
  /** Minimum fraction of the strip that must remain visible to be matched. */
  minVisible: number;
  /** Positions closer than this fraction of the strip width count as the same peak. */
  peakSeparation: number;
}

export const DEFAULT_ALIGN: AlignOptions = { maxShiftY: 3, minVisible: 0.5, peakSeparation: 0.5 };

/** Converts RGBA pixels to luminance. */
export function toGray(rgba: Uint8ClampedArray, width: number, height: number): GrayImage {
  const data = new Float32Array(width * height);
  for (let i = 0, p = 0; i < data.length; i++, p += 4) {
    data[i] = (0.299 * rgba[p] + 0.587 * rgba[p + 1] + 0.114 * rgba[p + 2]) / 255;
  }
  return { width, height, data };
}

/** Right-edge strip of an image (e.g. the last ~25% of the previous photo). */
export function rightStrip(image: GrayImage, fraction: number): GrayImage {
  const width = Math.max(4, Math.round(image.width * fraction));
  const x0 = image.width - width;
  const data = new Float32Array(width * image.height);
  for (let y = 0; y < image.height; y++) {
    data.set(image.data.subarray(y * image.width + x0, y * image.width + x0 + width), y * width);
  }
  return { width, height: image.height, data };
}

function variance(image: GrayImage): number {
  let sum = 0;
  let sq = 0;
  for (const v of image.data) {
    sum += v;
    sq += v * v;
  }
  const n = image.data.length;
  return sq / n - (sum / n) ** 2;
}

/** Zero-mean NCC of the strip placed at (dx, dy) in the live frame, over the visible part. */
function ncc(strip: GrayImage, live: GrayImage, dx: number, dy: number): number {
  const c0 = Math.max(0, -dx);
  const c1 = Math.min(strip.width, live.width - dx);
  const r0 = Math.max(0, -dy);
  const r1 = Math.min(strip.height, live.height - dy);
  if (c1 - c0 < 2 || r1 - r0 < 2) return -1;
  let sa = 0;
  let sb = 0;
  let saa = 0;
  let sbb = 0;
  let sab = 0;
  let n = 0;
  for (let r = r0; r < r1; r++) {
    const ra = r * strip.width;
    const rb = (r + dy) * live.width + dx;
    for (let c = c0; c < c1; c++) {
      const a = strip.data[ra + c];
      const b = live.data[rb + c];
      sa += a;
      sb += b;
      saa += a * a;
      sbb += b * b;
      sab += a * b;
      n++;
    }
  }
  const cov = sab - (sa * sb) / n;
  const va = saa - (sa * sa) / n;
  const vb = sbb - (sb * sb) / n;
  return va <= 1e-9 || vb <= 1e-9 ? -1 : cov / Math.sqrt(va * vb);
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function estimateOverlap(
  strip: GrayImage,
  live: GrayImage,
  options: AlignOptions = DEFAULT_ALIGN,
): AlignResult {
  if (strip.height !== live.height) throw new Error('Strip and frame must have the same height');
  // A featureless strip (blank wall, glare) cannot be matched.
  if (variance(strip) < 1e-4) return { overlap: 0, confidence: 0, peak: 0 };

  const minX = -Math.floor(strip.width * (1 - options.minVisible));
  const maxX = live.width - strip.width;
  const scores: { x: number; score: number }[] = [];
  for (let x = minX; x <= maxX; x++) {
    let best = -1;
    for (let dy = -options.maxShiftY; dy <= options.maxShiftY; dy++) {
      best = Math.max(best, ncc(strip, live, x, dy));
    }
    scores.push({ x, score: best });
  }
  const top = scores.reduce((a, b) => (b.score > a.score ? b : a));
  const separation = Math.max(2, Math.round(strip.width * options.peakSeparation));
  const second = scores
    .filter((s) => Math.abs(s.x - top.x) >= separation)
    .reduce((a, b) => (b.score > a ? b.score : a), -1);

  const overlap = clamp01((top.x + strip.width) / live.width);
  const strength = clamp01((top.score - 0.5) / 0.4);
  const distinct = clamp01((top.score - second) / 0.2);
  return { overlap, confidence: strength * distinct, peak: top.score };
}
