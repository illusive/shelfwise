import type { PlannedVisit, Store } from '@/domain/models';
import { formatAddressLines } from '@/i18n/format';
import { t } from '@/i18n/strings';
import { CheckIcon, ChevronRightIcon } from '@/ui/icons';
import { Badge } from '@/ui/primitives/Text';
import shared from '../shared/shared.module.css';
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

/** Planned visit as a Figma list row: logo (with route number), name, address, value, chevron. */
export function PlannedVisitCard({
  plan,
  store,
  status,
  daysSince,
  onOpen,
}: PlannedVisitCardProps) {
  const [line1, line2] = formatAddressLines(store.address);
  return (
    <button
      type="button"
      className={styles.row}
      data-status={status}
      data-testid="planned-visit"
      onClick={onOpen}
    >
      <span className={styles.logo}>
        <StoreLogo store={store} size="sm" />
        <span className={styles.order} aria-label={t.home.stop(plan.order)}>
          {plan.order}
        </span>
      </span>
      <span className={styles.body}>
        <span className={styles.name} data-testid="planned-store-name">
          {store.name}
        </span>
        <span className={styles.sub}>{line1}</span>
        <span className={styles.meta}>{line2}</span>
      </span>
      <span className={styles.value}>
        {status === 'done' ? (
          <Badge tone="accent" icon={<CheckIcon size={12} />}>
            {t.home.visited}
          </Badge>
        ) : status === 'in-progress' ? (
          <Badge tone="warning">{t.home.inProgress}</Badge>
        ) : daysSince === null ? null : (
          <>
            <span className={styles.big}>{daysSince}</span>
            <span className={styles.label}>{t.home.daysSinceLabel(daysSince)}</span>
          </>
        )}
      </span>
      <ChevronRightIcon size={18} className={shared.chevron} />
    </button>
  );
}
