export interface ImageProcessor {
  dimensions(blob: Blob): Promise<{ width: number; height: number }>;
  /** Small preview for lists; the original is kept untouched for analysis. */
  thumbnail(blob: Blob): Promise<Blob | null>;
}

const THUMB_MAX = 480;
export const PHOTO_MIME = 'image/jpeg';
/** High quality JPEG: price labels need fine detail. Originals are never downscaled. */
export const PHOTO_QUALITY = 0.92;

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Canvas encoding failed'))),
      type,
      quality,
    ),
  );
}

export const browserImageProcessor: ImageProcessor = {
  async dimensions(blob) {
    const bitmap = await createImageBitmap(blob);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  },
  async thumbnail(blob) {
    try {
      const bitmap = await createImageBitmap(blob);
      const scale = Math.min(1, THUMB_MAX / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      return await canvasToBlob(canvas, PHOTO_MIME, 0.8);
    } catch {
      return null;
    }
  },
};

/** Grabs the current video frame at the stream's full resolution. */
export async function captureVideoFrame(video: HTMLVideoElement): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx || canvas.width === 0) throw new Error('Camera frame not ready');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvasToBlob(canvas, PHOTO_MIME, PHOTO_QUALITY);
}
