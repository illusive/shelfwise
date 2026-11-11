import { rightStrip, toGray, type GrayImage } from '../guide/alignment';

/** Width of the grayscale frames used for overlap alignment. */
export const ALIGN_WIDTH = 96;
const ALIGN_MAX_HEIGHT = 160;
const DETECT_WIDTH = 480;

/** Part of the video frame visible in the element (object-fit: cover), in video pixels. */
export function visibleCrop(video: HTMLVideoElement) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const cw = video.clientWidth || vw;
  const ch = video.clientHeight || vh;
  const scale = Math.max(cw / vw, ch / vh);
  const sw = cw / scale;
  const sh = ch / scale;
  return { sx: (vw - sw) / 2, sy: (vh - sh) / 2, sw, sh, aspect: ch / cw };
}

/** Downscaled grayscale of what the rep sees in the viewfinder. */
export function grabAlignFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement): GrayImage {
  const { sx, sy, sw, sh, aspect } = visibleCrop(video);
  const width = ALIGN_WIDTH;
  const height = Math.min(ALIGN_MAX_HEIGHT, Math.max(8, Math.round(width * aspect)));
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, width, height);
  return toGray(ctx.getImageData(0, 0, width, height).data, width, height);
}

/** Full frame, downscaled, for drink detection. */
export function grabDetectFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement) {
  canvas.width = DETECT_WIDTH;
  canvas.height = Math.round((DETECT_WIDTH * video.videoHeight) / video.videoWidth);
  canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
  return createImageBitmap(canvas);
}

/**
 * Right-edge strip of the current viewfinder: a grayscale copy for alignment and a canvas
 * shown translucently on the left of the viewfinder (no image encoding, so it is cheap).
 */
export function grabStrip(video: HTMLVideoElement, fraction: number) {
  const gray = rightStrip(grabAlignFrame(video, document.createElement('canvas')), fraction);
  const { sx, sy, sw, sh } = visibleCrop(video);
  const display = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  display.width = Math.max(1, Math.round(video.clientWidth * fraction * dpr));
  display.height = Math.max(1, Math.round(video.clientHeight * dpr));
  display
    .getContext('2d')
    ?.drawImage(
      video,
      sx + sw * (1 - fraction),
      sy,
      sw * fraction,
      sh,
      0,
      0,
      display.width,
      display.height,
    );
  return { gray, display };
}
