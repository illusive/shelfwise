import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'motion/react';
import type { ReactNode } from 'react';
import { t } from '@/i18n/strings';
import { CloseIcon } from '../icons';
import { IconButton } from './Button';
import styles from './Sheet.module.css';

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  tone?: 'paper' | 'dark';
}

/** Accessible bottom sheet (Radix Dialog) with an interruptible slide-in/out. */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  tone = 'paper',
}: SheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className={styles.overlay}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount>
              <motion.div
                className={`${styles.sheet} ${styles[tone]}`}
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', stiffness: 420, damping: 40, mass: 0.9 }}
              >
                <div className={styles.handle} aria-hidden="true" />
                <div className={styles.header}>
                  <Dialog.Title className={styles.title}>{title}</Dialog.Title>
                  <Dialog.Close asChild>
                    <IconButton label={t.common.close} tone="outline">
                      <CloseIcon />
                    </IconButton>
                  </Dialog.Close>
                </div>
                {description ? (
                  <Dialog.Description className={styles.description}>
                    {description}
                  </Dialog.Description>
                ) : (
                  <Dialog.Description className="visually-hidden">{title}</Dialog.Description>
                )}
                <div className={styles.body}>{children}</div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
