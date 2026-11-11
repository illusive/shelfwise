import { rightStrip, toGray, type GrayImage } from '../guide/alignment';

/** Width of the grayscale frames used for overlap alignment. */
export const ALIGN_WIDTH = 96;
const ALIGN_MAX_HEIGHT = 160;
const DETECT_WIDTH = 480;

export interface Crop {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  /** View height ÷ view width. */
  aspect: number;
}

/** Part of a source image visible in a view of the given size with object-fit: cover. */
export function coverCrop(srcW: number, srcH: number, viewW: number, viewH: number): Crop {
  const cw = viewW || srcW;
  const ch = viewH || srcH;
  const scale = Math.max(cw / srcW, ch / srcH);
  const sw = cw / scale;
  const sh = ch / scale;
  return { sx: (srcW - sw) / 2, sy: (srcH - sh) / 2, sw, sh, aspect: ch / cw };
}

/** Part of the video frame visible in the element (object-fit: cover), in video pixels. */
export function visibleCrop(video: HTMLVideoElement): Crop {
  return coverCrop(video.videoWidth, video.videoHeight, video.clientWidth, video.clientHeight);
}

function context(canvas: HTMLCanvasElement, readBack = false) {
  const ctx = canvas.getContext('2d', readBack ? { willReadFrequently: true } : undefined);
  // iOS returns null once its total canvas memory budget is used up.
  if (!ctx) throw new Error('Canvas unavailable');
  return ctx;
}

function grayOf(source: CanvasImageSource, crop: Crop, canvas: HTMLCanvasElement): GrayImage {
  const width = ALIGN_WIDTH;
  const height = Math.min(ALIGN_MAX_HEIGHT, Math.max(8, Math.round(width * crop.aspect)));
  canvas.width = width;
  canvas.height = height;
  const ctx = context(canvas, true);
  ctx.drawImage(source, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, width, height);
  return toGray(ctx.getImageData(0, 0, width, height).data, width, height);
}

/** Downscaled grayscale of what the rep sees in the viewfinder. */
export function grabAlignFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement): GrayImage {
  return grayOf(video, visibleCrop(video), canvas);
}

/** Full frame, downscaled, for drink detection. */
export function grabDetectFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement) {
  canvas.width = DETECT_WIDTH;
  canvas.height = Math.round((DETECT_WIDTH * video.videoHeight) / video.videoWidth);
  context(canvas).drawImage(video, 0, 0, canvas.width, canvas.height);
  return createImageBitmap(canvas);
}

/**
 * True when a frame has no picture: an unpainted video frame reads as (near) black. A plain,
 * evenly lit surface is still a picture and is not rejected.
 */
export function isBlank(image: GrayImage): boolean {
  let max = 0;
  for (const v of image.data) if (v > max) max = v;
  return max < 0.04;
}

export interface Strip {
  /** Grayscale strip used as the alignment reference. */
  gray: GrayImage;
  /** Canvas shown translucently on the left of the viewfinder. */
  display: HTMLCanvasElement;
}

const alignScratch = () => document.createElement('canvas');
let scratch: HTMLCanvasElement | null = null;

function stripFrom(
  source: CanvasImageSource,
  crop: Crop,
  viewW: number,
  viewH: number,
  fraction: number,
): Strip {
  scratch ??= alignScratch();
  const gray = rightStrip(grayOf(source, crop, scratch), fraction);
  if (isBlank(gray)) throw new Error('Blank frame');
  const display = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  display.width = Math.max(1, Math.round(viewW * fraction * dpr));
  display.height = Math.max(1, Math.round(viewH * dpr));
  context(display).drawImage(
    source,
    crop.sx + crop.sw * (1 - fraction),
    crop.sy,
    crop.sw * fraction,
    crop.sh,
    0,
    0,
    display.width,
    display.height,
  );
  return { gray, display };
}

/**
 * Right-edge strip of the current viewfinder (no image encoding, so it is cheap). Throws when
 * the frame cannot be read or is blank; callers then fall back to `stripFromPhoto`.
 */
export function grabStrip(video: HTMLVideoElement, fraction: number): Strip {
  return stripFrom(video, visibleCrop(video), video.clientWidth, video.clientHeight, fraction);
}

/** Same strip, built from the saved photo (fallback when the live frame cannot be read). */
export async function stripFromPhoto(
  photo: Blob,
  viewW: number,
  viewH: number,
  fraction: number,
): Promise<Strip> {
  const bitmap = await createImageBitmap(photo);
  try {
    return stripFrom(
      bitmap,
      coverCrop(bitmap.width, bitmap.height, viewW, viewH),
      viewW,
      viewH,
      fraction,
    );
  } finally {
    bitmap.close();
  }
}

/** Frees a strip canvas's memory (iOS limits total canvas memory). */
export function releaseCanvas(canvas: HTMLCanvasElement | null) {
  if (!canvas) return;
  canvas.width = 0;
  canvas.height = 0;
}
