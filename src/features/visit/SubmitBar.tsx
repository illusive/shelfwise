import { useState } from 'react';
import { t } from '@/i18n/strings';
import { CloseIcon } from '@/ui/icons';
import { Button } from '@/ui/primitives/Button';
import { Sheet } from '@/ui/primitives/Sheet';
import { SwipeToConfirm } from '@/ui/primitives/SwipeToConfirm';
import shared from '../shared/shared.module.css';
import styles from './SubmitBar.module.css';

export interface SubmitBarProps {
  photoCount: number;
  submitting: boolean;
  onSubmit: () => Promise<unknown>;
  onDiscard: () => Promise<unknown>;
}

/** Draft action bar: swipe to analyse, and a round × to discard (with confirmation). */
export function SubmitBar({ photoCount, submitting, onSubmit, onDiscard }: SubmitBarProps) {
  const [confirming, setConfirming] = useState(false);
  return (
    <div className={styles.bar}>
      <SwipeToConfirm
        label={t.store.analyse(photoCount)}
        disabled={photoCount === 0 || submitting}
        onConfirm={onSubmit}
      />
      <button
        type="button"
        className={styles.discard}
        aria-label={t.store.discard}
        onClick={() => {
          // Nothing captured yet: nothing to lose, so discard without asking.
          if (photoCount === 0) void onDiscard();
          else setConfirming(true);
        }}
      >
        <CloseIcon size={22} />
      </button>
      <Sheet
        open={confirming}
        onOpenChange={setConfirming}
        title={t.store.discardTitle}
        description={t.store.discardConfirm(photoCount)}
      >
        <div className={shared.stack}>
          <Button
            variant="danger"
            block
            size="lg"
            onClick={async () => {
              setConfirming(false);
              await onDiscard();
            }}
          >
            {t.store.discardYes}
          </Button>
          <Button variant="secondary" block size="lg" onClick={() => setConfirming(false)}>
            {t.store.discardNo}
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
