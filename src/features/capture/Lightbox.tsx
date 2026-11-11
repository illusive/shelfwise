import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import type { Capture } from '@/domain/models';
import { formatTime, padSequence } from '@/i18n/format';
import { t } from '@/i18n/strings';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  RefreshIcon,
  TrashIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from '@/ui/icons';
import { IconButton } from '@/ui/primitives/Button';
import { useBlobUrl } from '@/ui/primitives/useBlobUrl';
import styles from './Lightbox.module.css';

export interface LightboxProps {
  captures: Capture[];
  /** The open capture, or null when closed. */
  openId: string | null;
  timeZone: string;
  editable: boolean;
  onOpenChange: (id: string | null) => void;
  onRetake: (capture: Capture) => void;
  onRemove: (capture: Capture) => void;
}

/** Full-screen photo view: back, previous/next, full-size zoom, retake and remove. */
export function Lightbox({
  captures,
  openId,
  timeZone,
  editable,
  onOpenChange,
  onRetake,
  onRemove,
}: LightboxProps) {
  const index = captures.findIndex((c) => c.id === openId);
  const capture = index >= 0 ? captures[index] : undefined;
  const go = (offset: number) => {
    const next = captures[index + offset];
    if (next) onOpenChange(next.id);
  };

  return (
    <Dialog.Root open={Boolean(capture)} onOpenChange={(open) => !open && onOpenChange(null)}>
      <AnimatePresence>
        {capture && (
          <Dialog.Portal forceMount>
            <Dialog.Content asChild forceMount aria-describedby={undefined}>
              <motion.div
                className={styles.lightbox}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.18 }}
                data-testid="lightbox"
              >
                <header className={styles.top}>
                  <Dialog.Close asChild>
                    <IconButton label={t.common.back} tone="outline-light">
                      <ArrowLeftIcon size={20} />
                    </IconButton>
                  </Dialog.Close>
                  <div className={styles.title}>
                    <Dialog.Title className={styles.heading}>
                      {t.store.capture(padSequence(capture.sequence))}
                    </Dialog.Title>
                    <span className={styles.meta}>
                      {formatTime(capture.capturedAt, timeZone)} ·{' '}
                      {t.photo.of(index + 1, captures.length)}
                    </span>
                  </div>
                </header>
                <ZoomableImage key={capture.id} capture={capture} />
                <footer className={styles.actions}>
                  <IconButton
                    label={t.photo.previous}
                    tone="outline-light"
                    disabled={index <= 0}
                    onClick={() => go(-1)}
                  >
                    <ArrowLeftIcon size={20} />
                  </IconButton>
                  {editable && (
                    <>
                      <IconButton
                        label={t.camera.retake}
                        tone="outline-light"
                        onClick={() => onRetake(capture)}
                      >
                        <RefreshIcon size={20} />
                      </IconButton>
                      <IconButton
                        label={t.camera.remove}
                        tone="outline-light"
                        className={styles.danger}
                        onClick={() => onRemove(capture)}
                      >
                        <TrashIcon size={20} />
                      </IconButton>
                    </>
                  )}
                  <IconButton
                    label={t.photo.next}
                    tone="outline-light"
                    disabled={index >= captures.length - 1}
                    onClick={() => go(1)}
                  >
                    <ArrowRightIcon size={20} />
                  </IconButton>
                </footer>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}

/**
 * Fits the photo to the screen; the zoom toggle (or a double-tap) shows it at full
 * resolution — one image pixel per device pixel — and the rep can pan around.
 */
function ZoomableImage({ capture }: { capture: Capture }) {
  const url = useBlobUrl(capture.blobId);
  const stage = useRef<HTMLDivElement>(null);
  const [zoomed, setZoomed] = useState(false);
  const fullWidth = Math.max(
    capture.width / (window.devicePixelRatio || 1),
    (stage.current?.clientWidth ?? 0) * 2,
  );

  // Centre the view on zoom-in.
  useEffect(() => {
    const el = stage.current;
    if (!el || !zoomed) return;
    el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
    el.scrollTop = (el.scrollHeight - el.clientHeight) / 2;
  }, [zoomed]);

  return (
    <div className={styles.stageWrap}>
      <div
        ref={stage}
        className={styles.stage}
        data-zoomed={zoomed}
        onDoubleClick={() => setZoomed((z) => !z)}
      >
        {url && (
          <img
            src={url}
            alt={t.store.capture(padSequence(capture.sequence))}
            className={styles.image}
            style={zoomed ? { width: fullWidth, maxWidth: 'none', height: 'auto' } : undefined}
            draggable={false}
          />
        )}
      </div>
      <IconButton
        label={zoomed ? t.common.zoomOut : t.common.zoomIn}
        tone="dark"
        className={styles.zoom}
        aria-pressed={zoomed}
        onClick={() => setZoomed((z) => !z)}
      >
        {zoomed ? <ZoomOutIcon /> : <ZoomInIcon />}
      </IconButton>
    </div>
  );
}
