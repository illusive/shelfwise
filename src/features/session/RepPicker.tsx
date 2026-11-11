import { useInvalidate, useReps } from '@/app/data';
import { useServices } from '@/app/services-context';
import { t } from '@/i18n/strings';
import { ChevronRightIcon, UserIcon } from '@/ui/icons';
import { Screen, Wordmark } from '@/ui/primitives/Screen';
import shared from '../shared/shared.module.css';
import styles from './session.module.css';

/** Seeded test-rep selection; stored locally. Not authentication. */
export function RepPicker() {
  const { data: reps = [] } = useReps();
  const { repos } = useServices();
  const invalidate = useInvalidate();

  const choose = async (id: string) => {
    await repos.session.setCurrentRepId(id);
    await invalidate();
  };

  return (
    <Screen>
      <Wordmark />
      <div className={shared.stackTight}>
        <h1 className={shared.displayTitle}>{t.reps.title}</h1>
        <p className={shared.muted}>{t.reps.subtitle}</p>
      </div>
      <ul className={styles.reps}>
        {reps.map((rep) => (
          <li key={rep.id}>
            <button type="button" className={styles.rep} onClick={() => void choose(rep.id)}>
              <span className={styles.avatar}>
                <UserIcon />
              </span>
              <span className={styles.repBody}>
                <span className={styles.repName}>{rep.name}</span>
                <span className={shared.muted}>{rep.region}</span>
              </span>
              <ChevronRightIcon className={shared.chevron} />
            </button>
          </li>
        ))}
      </ul>
    </Screen>
  );
}
