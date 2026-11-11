import { useState } from 'react';
import { useCurrentRep, useInvalidate, useReps } from '@/app/data';
import { useServices } from '@/app/services-context';
import { t } from '@/i18n/strings';
import { addDemoHistory } from '@/services/demoData';
import { CheckIcon, UserIcon } from '@/ui/icons';
import { Button } from '@/ui/primitives/Button';
import { Sheet } from '@/ui/primitives/Sheet';
import { useToast } from '@/ui/primitives/Toast';
import shared from '../shared/shared.module.css';
import styles from './session.module.css';

export function RepSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const services = useServices();
  const { data: reps = [] } = useReps();
  const { data: current } = useCurrentRep();
  const invalidate = useInvalidate();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const choose = async (id: string) => {
    await services.repos.session.setCurrentRepId(id);
    await invalidate();
    onOpenChange(false);
  };

  const demo = async () => {
    if (!current) return;
    setBusy(true);
    try {
      await addDemoHistory(services, current.id);
      await invalidate();
      toast(t.reps.demoAdded);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t.reps.switch}>
      <ul className={styles.reps}>
        {reps.map((rep) => (
          <li key={rep.id}>
            <button
              type="button"
              className={styles.rep}
              aria-pressed={rep.id === current?.id}
              onClick={() => void choose(rep.id)}
            >
              <span className={styles.avatar}>
                <UserIcon />
              </span>
              <span className={styles.repBody}>
                <span className={styles.repName}>{rep.name}</span>
                <span className={shared.muted}>{rep.region}</span>
              </span>
              {rep.id === current?.id && <CheckIcon />}
            </button>
          </li>
        ))}
      </ul>
      <div className={shared.stackTight}>
        <Button variant="secondary" block disabled={busy} onClick={() => void demo()}>
          {busy ? t.common.loading : t.reps.demoData}
        </Button>
        <p className={shared.muted}>{t.reps.demoDataHint}</p>
      </div>
    </Sheet>
  );
}
