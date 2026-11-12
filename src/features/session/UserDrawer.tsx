import { useState } from 'react';
import { BUILD } from '@/app/build';
import { formatBuildDate } from '@/i18n/format';
import { useCurrentRep, useInvalidate, useReps, useTrainingConsent } from '@/app/data';
import { devToolsEnabled } from '@/app/devTools';
import { signIn, signOut, useAuth } from '@/app/auth';
import { useServices } from '@/app/services-context';
import { t } from '@/i18n/strings';
import { addDemoHistory } from '@/services/demoData';
import { CheckIcon } from '@/ui/icons';
import { Button } from '@/ui/primitives/Button';
import { Sheet } from '@/ui/primitives/Sheet';
import { SectionHeader } from '@/ui/primitives/Text';
import { useToast } from '@/ui/primitives/Toast';
import { Segmented } from '@/ui/primitives/Segmented';
import { Switch } from '@/ui/primitives/Switch';
import { LANGUAGES, setLanguage, useLanguage, type Language } from '@/i18n/language';
import shared from '../shared/shared.module.css';
import { Avatar } from './Avatar';
import { TrainingExport } from './TrainingExport';
import styles from './session.module.css';

/** User drawer: shows the current test rep, switches rep, and seeds demo history. */
export function UserDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const services = useServices();
  const { data: reps = [] } = useReps();
  const { data: current } = useCurrentRep();
  const invalidate = useInvalidate();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const language = useLanguage();
  const { data: consent = false } = useTrainingConsent(current?.id);
  const devTools = devToolsEnabled();
  const auth = useAuth();

  const setConsent = async (on: boolean) => {
    if (!current) return;
    await services.repos.settings.setTrainingConsent(current.id, on);
    await invalidate();
  };

  const choose = async (id: string) => {
    if (id !== current?.id) {
      await services.repos.session.setCurrentRepId(id);
      await invalidate();
    }
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
    <Sheet open={open} onOpenChange={onOpenChange} title={t.reps.drawerTitle}>
      {current && (
        <div className={styles.current}>
          <Avatar name={current.name} size="lg" />
          <div className={styles.repBody}>
            <span className={shared.muted}>{t.reps.current}</span>
            <span className={styles.currentName}>{current.name}</span>
            <span className={shared.muted}>{current.region}</span>
          </div>
        </div>
      )}
      <SectionHeader title={t.reps.language} />
      <Segmented<Language>
        label={t.reps.language}
        value={language}
        onChange={setLanguage}
        options={LANGUAGES.map((l) => ({ value: l, label: t.reps.languages[l] }))}
      />
      {auth.status !== 'disabled' && (
        <>
          <SectionHeader title={t.reps.account} />
          <div className={styles.account} data-testid="microsoft-account">
            {auth.account ? (
              <>
                <div className={styles.repBody}>
                  <span className={styles.repName}>{auth.account.name}</span>
                  <span className={shared.muted}>{auth.account.username}</span>
                </div>
                <Button variant="secondary" size="sm" onClick={() => void signOut()}>
                  {t.reps.signOut}
                </Button>
              </>
            ) : (
              <div className={shared.stackTight}>
                <p className={shared.muted}>
                  {auth.status === 'error' ? t.reps.signInFailed : t.reps.accountHint}
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={auth.status === 'loading'}
                  onClick={() => void signIn()}
                >
                  {t.reps.signIn}
                </Button>
              </div>
            )}
          </div>
        </>
      )}
      <SectionHeader title={t.reps.dataUse} />
      <Switch
        label={t.reps.trainingConsent}
        hint={t.reps.trainingConsentHint}
        checked={consent}
        disabled={!current}
        onCheckedChange={(on) => void setConsent(on)}
        testId="training-consent"
      />
      <SectionHeader title={t.reps.switch} />
      <ul className={styles.reps}>
        {reps.map((rep) => (
          <li key={rep.id}>
            <button
              type="button"
              className={styles.rep}
              aria-pressed={rep.id === current?.id}
              onClick={() => void choose(rep.id)}
            >
              <Avatar name={rep.name} />
              <span className={styles.repBody}>
                <span className={styles.repName}>{rep.name}</span>
                <span className={shared.muted}>{rep.region}</span>
              </span>
              {rep.id === current?.id && <CheckIcon />}
            </button>
          </li>
        ))}
      </ul>
      <p className={shared.muted}>{t.reps.note}</p>
      <div className={shared.stackTight}>
        <Button variant="secondary" block disabled={busy} onClick={() => void demo()}>
          {busy ? t.common.loading : t.reps.demoData}
        </Button>
        <p className={shared.muted}>{t.reps.demoDataHint}</p>
      </div>
      {devTools && open && <TrainingExport />}
      <p className={styles.build} data-testid="app-version">
        {t.reps.build(BUILD.version, BUILD.commit, formatBuildDate(BUILD.builtAt))}
      </p>
    </Sheet>
  );
}
