import { hasJpegMetadata, isJpeg, stripJpegMetadata } from './jpeg';

export interface SanitizedImage {
  bytes: Uint8Array;
  mimeType: string;
  /** True when the image was decoded and re-encoded to drop metadata (orientation baked in). */
  reencoded: boolean;
}

/** Returns image bytes safe to share (no EXIF/XMP/GPS), or null if that can't be ensured. */
export type ImageSanitizer = (blob: Blob) => Promise<SanitizedImage | null>;

export function createImageSanitizer(reencode: (blob: Blob) => Promise<Blob>): ImageSanitizer {
  return async (blob) => {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    // In-app camera photos are canvas JPEGs without metadata: shared byte-for-byte.
    if (isJpeg(bytes) && !hasJpegMetadata(bytes)) {
      return { bytes, mimeType: 'image/jpeg', reencoded: false };
    }
    try {
      const encoded = await reencode(blob);
      return {
        bytes: new Uint8Array(await encoded.arrayBuffer()),
        mimeType: 'image/jpeg',
        reencoded: true,
      };
    } catch {
      const stripped = isJpeg(bytes) ? stripJpegMetadata(bytes) : null;
      return stripped ? { bytes: stripped, mimeType: 'image/jpeg', reencoded: false } : null;
    }
  };
}

/** Decodes (applying EXIF orientation) and re-encodes as a metadata-free JPEG. */
export async function browserReencode(blob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  try {
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable');
    ctx.drawImage(bitmap, 0, 0);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Encode failed'))),
        'image/jpeg',
        0.92,
      ),
    );
  } finally {
    bitmap.close();
    canvas.width = 0;
    canvas.height = 0;
  }
}
