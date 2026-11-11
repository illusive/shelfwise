import type { CSSProperties } from 'react';
import { ImageIcon } from '../icons';
import styles from './BlobImage.module.css';
import { useBlobUrl } from './useBlobUrl';

export interface BlobImageProps {
  blobId: string | null | undefined;
  /** Fallback when the thumbnail is missing. */
  fallbackBlobId?: string | null;
  alt: string;
  className?: string;
  style?: CSSProperties;
  fit?: 'cover' | 'contain';
}

export function BlobImage({ blobId, fallbackBlobId, alt, className, style, fit = 'cover' }: BlobImageProps) {
  const url = useBlobUrl(blobId ?? fallbackBlobId);
  return (
    <div className={`${styles.frame} ${className ?? ''}`} style={style}>
      {url ? (
        <img src={url} alt={alt} className={styles.img} style={{ objectFit: fit }} draggable={false} />
      ) : (
        <span className={styles.placeholder} role="img" aria-label={alt}>
          <ImageIcon />
        </span>
      )}
    </div>
  );
}
