import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'motion/react';
import type { Capture } from '@/domain/models';
import { formatTime, padSequence } from '@/i18n/format';
import { t } from '@/i18n/strings';
import { ArrowLeftIcon, ArrowRightIcon, RefreshIcon, TrashIcon } from '@/ui/icons';
import { BlobImage } from '@/ui/primitives/BlobImage';
import { Button, IconButton } from '@/ui/primitives/Button';
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

/** Full-screen photo view with back, retake and remove. */
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
                    <IconButton label={t.common.back}>
                      <ArrowLeftIcon />
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
                <div className={styles.stage}>
                  <BlobImage
                    blobId={capture.blobId}
                    alt={t.store.capture(padSequence(capture.sequence))}
                    className={styles.image}
                    fit="contain"
                  />
                  {index > 0 && (
                    <IconButton
                      label={t.photo.previous}
                      tone="dark"
                      className={`${styles.nav} ${styles.prev}`}
                      onClick={() => go(-1)}
                    >
                      <ArrowLeftIcon />
                    </IconButton>
                  )}
                  {index < captures.length - 1 && (
                    <IconButton
                      label={t.photo.next}
                      tone="dark"
                      className={`${styles.nav} ${styles.next}`}
                      onClick={() => go(1)}
                    >
                      <ArrowRightIcon />
                    </IconButton>
                  )}
                </div>
                {editable && (
                  <footer className={styles.actions}>
                    <Button
                      variant="secondary"
                      icon={<RefreshIcon size={18} />}
                      onClick={() => onRetake(capture)}
                    >
                      {t.camera.retake}
                    </Button>
                    <Button
                      variant="danger"
                      icon={<TrashIcon size={18} />}
                      onClick={() => onRemove(capture)}
                    >
                      {t.camera.remove}
                    </Button>
                  </footer>
                )}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
