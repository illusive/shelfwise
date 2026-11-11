import type { Region } from '@/contracts/analysis';
import { useBlobUrl } from '@/ui/primitives/useBlobUrl';
import styles from './results.module.css';

/** Shows just the evidence region of a photo, with a little context around it. */
export function EvidenceCrop({
  blobId,
  region,
  label,
}: {
  blobId: string;
  region: Region | null;
  label: string;
}) {
  const url = useBlobUrl(blobId);
  const pad = 0.04;
  const r = region
    ? {
        x: Math.max(0, region.x - pad),
        y: Math.max(0, region.y - pad),
        width: Math.min(1, region.width + pad * 2),
        height: Math.min(1, region.height + pad * 2),
      }
    : { x: 0, y: 0, width: 1, height: 1 };
  const sizeX = 100 / r.width;
  const sizeY = 100 / r.height;
  const posX = r.width >= 1 ? 0 : (r.x / (1 - r.width)) * 100;
  const posY = r.height >= 1 ? 0 : (r.y / (1 - r.height)) * 100;
  return (
    <div
      role="img"
      aria-label={label}
      className={styles.crop}
      style={
        url
          ? {
              backgroundImage: `url(${url})`,
              backgroundSize: `${sizeX}% ${sizeY}%`,
              backgroundPosition: `${Math.min(100, posX)}% ${Math.min(100, posY)}%`,
            }
          : undefined
      }
    />
  );
}
