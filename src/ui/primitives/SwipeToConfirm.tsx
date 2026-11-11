import { animate, motion, useMotionValue, useTransform } from 'motion/react';
import { useRef, useState } from 'react';
import { ArrowRightIcon } from '../icons';
import styles from './SwipeToConfirm.module.css';

const THUMB = 48;
const PAD = 4;
const THRESHOLD = 0.75;

export interface SwipeToConfirmProps {
  label: string;
  disabled?: boolean;
  /** Runs once the thumb reaches the end. The control resets when it settles. */
  onConfirm: () => Promise<unknown> | void;
}

/**
 * Drag the thumb to the end to confirm — prevents accidental submissions. Keyboard and
 * assistive-technology activation (Enter/Space, synthetic clicks) also confirm.
 */
export function SwipeToConfirm({ label, disabled = false, onConfirm }: SwipeToConfirmProps) {
  const track = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const [busy, setBusy] = useState(false);
  const range = () => Math.max(1, (track.current?.offsetWidth ?? THUMB) - THUMB - PAD * 2);
  const labelOpacity = useTransform(x, (v) => 1 - Math.min(1, v / range()) * 1.4);
  const fill = useTransform(x, (v) => v + THUMB + PAD);

  const confirm = async () => {
    if (disabled || busy) return;
    setBusy(true);
    await animate(x, range(), { duration: 0.15 });
    try {
      await onConfirm();
    } finally {
      setBusy(false);
      void animate(x, 0, { type: 'spring', stiffness: 500, damping: 40 });
    }
  };

  return (
    <div
      ref={track}
      className={styles.track}
      data-disabled={disabled}
      data-testid="swipe-to-confirm"
    >
      <motion.span className={styles.fill} style={{ width: fill }} aria-hidden="true" />
      <motion.span className={styles.label} style={{ opacity: labelOpacity }} aria-hidden="true">
        {label}
      </motion.span>
      <motion.button
        type="button"
        className={styles.thumb}
        aria-label={label}
        disabled={disabled || busy}
        drag={disabled || busy ? false : 'x'}
        dragConstraints={track}
        dragElastic={0}
        dragMomentum={false}
        style={{ x }}
        onDragEnd={() => {
          if (x.get() >= range() * THRESHOLD) void confirm();
          else void animate(x, 0, { type: 'spring', stiffness: 500, damping: 40 });
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            void confirm();
          }
        }}
        onClick={(e) => {
          // detail === 0: keyboard/assistive activation, not a pointer tap.
          if (e.detail === 0) void confirm();
        }}
      >
        <ArrowRightIcon size={20} />
      </motion.button>
    </div>
  );
}
