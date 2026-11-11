/**
 * Minimal JPEG marker walker for privacy: finds and removes metadata segments (EXIF/XMP in
 * APP1 — which can hold GPS location — IPTC in APP13, other APPn and comments). APP0 (JFIF)
 * and APP2 (ICC colour profile) are kept. Image data is untouched.
 */
const SOI = 0xd8;
const SOS = 0xda;
const COM = 0xfe;

function isMetadataMarker(marker: number): boolean {
  if (marker === COM) return true;
  // APP1 and APP3–APP15.
  return marker >= 0xe1 && marker <= 0xef && marker !== 0xe2;
}

export function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === SOI;
}

interface Segment {
  marker: number;
  start: number;
  end: number;
}

/** Header segments up to (not including) the start of scan; null if the file is malformed. */
function headerSegments(bytes: Uint8Array): { segments: Segment[]; scanStart: number } | null {
  if (!isJpeg(bytes)) return null;
  const segments: Segment[] = [];
  let i = 2;
  while (i + 4 <= bytes.length) {
    if (bytes[i] !== 0xff) return null;
    const marker = bytes[i + 1];
    if (marker === 0xff) {
      i += 1; // fill byte
      continue;
    }
    if (marker === SOS) return { segments, scanStart: i };
    const length = (bytes[i + 2] << 8) | bytes[i + 3];
    if (length < 2 || i + 2 + length > bytes.length) return null;
    segments.push({ marker, start: i, end: i + 2 + length });
    i += 2 + length;
  }
  return null;
}

export function hasJpegMetadata(bytes: Uint8Array): boolean {
  const parsed = headerSegments(bytes);
  return parsed !== null && parsed.segments.some((s) => isMetadataMarker(s.marker));
}

/** Returns a copy without metadata segments, or null if the JPEG can't be parsed safely. */
export function stripJpegMetadata(bytes: Uint8Array): Uint8Array | null {
  const parsed = headerSegments(bytes);
  if (!parsed) return null;
  const kept = parsed.segments.filter((s) => !isMetadataMarker(s.marker));
  const headerLength = kept.reduce((n, s) => n + (s.end - s.start), 0);
  const out = new Uint8Array(2 + headerLength + (bytes.length - parsed.scanStart));
  out.set([0xff, SOI], 0);
  let offset = 2;
  for (const s of kept) {
    out.set(bytes.subarray(s.start, s.end), offset);
    offset += s.end - s.start;
  }
  out.set(bytes.subarray(parsed.scanStart), offset);
  return out;
}
