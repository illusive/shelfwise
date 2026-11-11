import { useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useCurrentRep, usePlannedVisits, useStores, useVisitSummaries } from '@/app/data';
import { aggregateShare, latestPerKey } from '@/domain/aggregate';
import { dateKeyIn, daysBetween, weekOf } from '@/domain/dates';
import { isJobActive, type PlannedVisit } from '@/domain/models';
import { formatPct, formatWeekdayLong, localDateKey } from '@/i18n/format';
import { t } from '@/i18n/strings';
import type { VisitSummary } from '@/services/visitSummaries';
import { AlertIcon, CheckIcon, StoreIcon } from '@/ui/icons';
import { Button } from '@/ui/primitives/Button';
import { Screen } from '@/ui/primitives/Screen';
import { EmptyState, SectionHeader } from '@/ui/primitives/Text';
import { AppHeader } from '../session/AppHeader';
import shared from '../shared/shared.module.css';
import { useVisitActions } from '../visit/useVisitActions';
import { DayStrip } from './DayStrip';
import styles from './HomePage.module.css';
import { PlannedVisitCard, type PlanStatus } from './PlannedVisitCard';

/** The rep's own visit to the plan's store on the plan's day, if any. */
function visitForPlan(plan: PlannedVisit, own: VisitSummary[]): VisitSummary | undefined {
  return own.find(
    (s) =>
      s.store.id === plan.storeId &&
      (s.visit.status === 'draft' ||
        localDateKey(s.visit.createdAt, s.store.timeZone) === plan.date),
  );
}

function statusOf(summary: VisitSummary | undefined): PlanStatus {
  if (!summary) return 'todo';
  return summary.visit.status === 'completed' ? 'done' : 'in-progress';
}

export function HomePage() {
  const navigate = useNavigate();
  const actions = useVisitActions();
  const { data: rep } = useCurrentRep();
  const { data: stores = [] } = useStores();
  const { data: own = [] } = useVisitSummaries({ repId: rep?.id });
  const { data: all = [] } = useVisitSummaries({});
  const today = dateKeyIn(new Date().toISOString());
  const week = weekOf(today);
  const [selected, setSelected] = useState(today);
  const { data: plans = [] } = usePlannedVisits(rep?.id, week[0], week[6]);

  const storeById = useMemo(() => new Map(stores.map((s) => [s.id, s])), [stores]);
  const lastVisit = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of all) {
      if (s.visit.status !== 'completed' || !s.visit.completedAt) continue;
      const day = localDateKey(s.visit.completedAt, s.store.timeZone);
      if ((map.get(s.store.id) ?? '') < day) map.set(s.store.id, day);
    }
    return map;
  }, [all]);

  const dayPlans = plans.filter((p) => p.date === selected && storeById.has(p.storeId));
  const plannedDays = new Set(plans.map((p) => p.date));

  const month = today.slice(0, 7);
  const thisMonth = own.filter(
    (s) =>
      s.visit.status === 'completed' &&
      s.metrics &&
      localDateKey(s.visit.completedAt!, s.store.timeZone).slice(0, 7) === month,
  );
  const latestPerStore = latestPerKey(thisMonth, (s) => s.store.id);
  const monthShare = aggregateShare(latestPerStore.map((s) => s.metrics!.scopes.overall.sos));
  const processing = own.filter((s) => s.job && isJobActive(s.job.status)).length;
  const failed = own.filter(
    (s) => s.visit.status === 'submitted' && s.job?.status === 'failed',
  ).length;

  const open = async (plan: PlannedVisit) => {
    const existing = visitForPlan(plan, own);
    if (existing?.visit.status === 'completed') {
      return navigate({ to: '/visits/$visitId/results', params: { visitId: existing.visit.id } });
    }
    if (existing?.visit.status === 'submitted') {
      return navigate({
        to: '/visits/$visitId/processing',
        params: { visitId: existing.visit.id },
      });
    }
    if (rep) await actions.startVisit(plan.storeId, rep.id);
    return navigate({ to: '/stores/$storeId', params: { storeId: plan.storeId } });
  };

  return (
    <Screen nav>
      <AppHeader />
      <h1 className={shared.displayTitle}>{t.home.greeting(rep?.firstName ?? '')}</h1>

      <DayStrip
        days={week}
        today={today}
        selected={selected}
        planned={plannedDays}
        onSelect={setSelected}
      />

      <section className={styles.plan}>
        <SectionHeader
          title={
            selected === today ? t.home.todaysVisits : t.home.dayVisits(formatWeekdayLong(selected))
          }
          aside={t.home.plannedCount(dayPlans.length)}
        />
        {dayPlans.length === 0 ? (
          <EmptyState title={t.home.noPlanned} />
        ) : (
          <ol className={`${shared.list} ${styles.planList}`}>
            {dayPlans.map((plan) => {
              const store = storeById.get(plan.storeId)!;
              const last = lastVisit.get(store.id);
              return (
                <li key={plan.id}>
                  <PlannedVisitCard
                    plan={plan}
                    store={store}
                    status={statusOf(visitForPlan(plan, own))}
                    daysSince={last ? Math.max(0, daysBetween(last, today)) : null}
                    onOpen={() => void open(plan)}
                  />
                </li>
              );
            })}
          </ol>
        )}
        <Button
          variant="secondary"
          block
          icon={<StoreIcon size={18} />}
          onClick={() => void navigate({ to: '/stores' })}
        >
          {t.home.otherVisit}
        </Button>
      </section>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{latestPerStore.length}</span>
          <span className={styles.statLabel}>{t.home.storesVisited}</span>
        </div>
        <div className={styles.stat} title={t.home.overallShareHint}>
          <span className={styles.statValue}>
            {monthShare.sharePct === null ? '—' : formatPct(monthShare.sharePct)}
          </span>
          <span className={styles.statLabel}>{t.home.overallShare}</span>
        </div>
      </div>
      <p className={shared.footnote}>
        {failed > 0 ? (
          <>
            <AlertIcon size={14} /> {t.home.failed(failed)}
          </>
        ) : processing > 0 ? (
          t.home.processing(processing)
        ) : (
          <>
            <CheckIcon size={14} /> {t.home.upToDate}
          </>
        )}
      </p>
    </Screen>
  );
}
