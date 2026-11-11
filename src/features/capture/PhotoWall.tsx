import { AnimatePresence, motion } from 'motion/react';
import type { Capture } from '@/domain/models';
import { formatTime, padSequence } from '@/i18n/format';
import { t } from '@/i18n/strings';
import { CloseIcon } from '@/ui/icons';
import { BlobImage } from '@/ui/primitives/BlobImage';
import styles from './PhotoWall.module.css';

export interface PhotoWallProps {
  captures: Capture[];
  timeZone: string;
  /** Shows the remove (×) control on each photo. */
  editable: boolean;
  onOpen: (capture: Capture) => void;
  onRemove: (capture: Capture) => void;
}

/** Grid of captured photos (about three per row) with number/time and quick removal. */
export function PhotoWall({ captures, timeZone, editable, onOpen, onRemove }: PhotoWallProps) {
  return (
    <ul className={styles.wall} data-testid="photo-wall">
      <AnimatePresence initial={false}>
        {captures.map((c) => {
          const n = padSequence(c.sequence);
          return (
            <motion.li
              key={c.id}
              layout
              className={styles.item}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.18 }}
            >
              <button
                type="button"
                className={styles.open}
                aria-label={t.captures.open(n)}
                onClick={() => onOpen(c)}
              >
                <BlobImage
                  blobId={c.thumbBlobId}
                  fallbackBlobId={c.blobId}
                  alt=""
                  className={styles.image}
                />
                <span className={styles.chip}>{n}</span>
              </button>
              {editable && (
                <button
                  type="button"
                  className={styles.remove}
                  aria-label={t.captures.remove(n)}
                  onClick={() => onRemove(c)}
                >
                  <span className={styles.removeIcon}>
                    <CloseIcon size={14} strokeWidth={2.4} />
                  </span>
                </button>
              )}
              <span className={styles.meta}>
                {formatTime(c.capturedAt, timeZone)}
                {c.source === 'import' ? ` · ${t.captures.imported}` : ''}
              </span>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}
