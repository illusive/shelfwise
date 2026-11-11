import type { PlannedVisit, Store } from '@/domain/models';
import { formatAddressLines } from '@/i18n/format';
import { t } from '@/i18n/strings';
import { CheckIcon } from '@/ui/icons';
import { StoreLogo } from '../shared/StoreLogo';
import styles from './PlannedVisitCard.module.css';

export type PlanStatus = 'todo' | 'in-progress' | 'done';

export interface PlannedVisitCardProps {
  plan: PlannedVisit;
  store: Store;
  status: PlanStatus;
  /** Days since the store was last visited; null = never. */
  daysSince: number | null;
  onOpen: () => void;
}

/** Numbered route stop joined to its dark-green store card (as in the user's other app). */
export function PlannedVisitCard({
  plan,
  store,
  status,
  daysSince,
  onOpen,
}: PlannedVisitCardProps) {
  const [line1, line2] = formatAddressLines(store.address);
  const since =
    daysSince === null
      ? t.home.newStore
      : daysSince === 0
        ? t.common.today
        : t.home.daysSince(daysSince);
  return (
    <button
      type="button"
      className={styles.item}
      data-status={status}
      data-testid="planned-visit"
      onClick={onOpen}
    >
      <span className={styles.shapes} aria-hidden="true">
        <span className={styles.dotShape} />
        <span className={styles.neck} />
        <span className={styles.cardShape} />
      </span>
      <span className={styles.number} aria-hidden="true">
        {status === 'done' ? <CheckIcon size={14} strokeWidth={2.6} /> : plan.order}
      </span>
      <span className={styles.card}>
        <StoreLogo store={store} size="md" />
        <span className={styles.body}>
          <span className={styles.name} data-testid="planned-store-name">
            {store.name}
          </span>
          <span className={styles.address}>{line1}</span>
          <span className={styles.address}>{line2}</span>
          {(plan.tags.length > 0 || status !== 'todo') && (
            <span className={styles.chips}>
              {status !== 'todo' && (
                <span className={styles.statusChip}>
                  {status === 'done' ? t.home.visited : t.home.inProgress}
                </span>
              )}
              {plan.tags.map((tag) => (
                <span key={tag} className={styles.chip}>
                  {t.tags[tag]}
                </span>
              ))}
            </span>
          )}
        </span>
        <span className={styles.since}>{since}</span>
      </span>
    </button>
  );
}
