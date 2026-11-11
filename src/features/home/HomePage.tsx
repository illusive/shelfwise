import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useCurrentRep, useVisitSummaries } from '@/app/data';
import { aggregateShare, latestPerKey } from '@/domain/aggregate';
import { isJobActive } from '@/domain/models';
import { formatLongDay, formatPct, localDateKey } from '@/i18n/format';
import { t } from '@/i18n/strings';
import { AlertIcon, CheckIcon, UserIcon } from '@/ui/icons';
import { Button, IconButton } from '@/ui/primitives/Button';
import { Screen, Wordmark } from '@/ui/primitives/Screen';
import { EmptyState, Mono, SectionHeader } from '@/ui/primitives/Text';
import { RepSheet } from '../session/RepSheet';
import shared from '../shared/shared.module.css';
import { VisitRow } from '../shared/VisitRow';
import styles from './HomePage.module.css';

export function HomePage() {
  const navigate = useNavigate();
  const { data: rep } = useCurrentRep();
  const { data: summaries = [] } = useVisitSummaries({ repId: rep?.id });
  const [repSheet, setRepSheet] = useState(false);

  const now = new Date();
  const month = localDateKey(now.toISOString()).slice(0, 7);
  const completed = summaries.filter((s) => s.visit.status === 'completed' && s.metrics);
  const thisMonth = completed.filter(
    (s) => localDateKey(s.visit.completedAt!, s.store.timeZone).slice(0, 7) === month,
  );
  const latestPerStore = latestPerKey(thisMonth, (s) => s.store.id);
  const monthShare = aggregateShare(latestPerStore.map((s) => s.metrics!.scopes.overall.sos));
  const draft = summaries.find((s) => s.visit.status === 'draft');
  const processing = summaries.filter((s) => s.job && isJobActive(s.job.status)).length;
  const failed = summaries.filter((s) => s.visit.status === 'submitted' && s.job?.status === 'failed').length;
  const recent = summaries.filter((s) => s.visit.status !== 'draft').slice(0, 3);

  return (
    <Screen nav>
      <div className={shared.spread}>
        <Wordmark />
        <IconButton label={t.reps.switch} onClick={() => setRepSheet(true)}>
          <UserIcon />
        </IconButton>
      </div>

      <div className={shared.stackTight}>
        <h1 className={shared.displayTitle}>{t.home.greeting(rep?.firstName ?? '')}</h1>
        <Mono className={styles.date}>{formatLongDay(now.toISOString()).toUpperCase()}</Mono>
      </div>

      <div className={styles.hero}>
        <span className={styles.heroEyebrow}>SHELFWISE</span>
        <p className={styles.heroTitle}>
          {t.app.tagline[0]}
          <br />
          {t.app.tagline[1]}
        </p>
      </div>

      <div className={shared.stack}>
        {draft && (
          <Button
            block
            size="lg"
            withArrow
            onClick={() => void navigate({ to: '/stores/$storeId', params: { storeId: draft.store.id } })}
          >
            {t.home.resume(draft.store.name)}
          </Button>
        )}
        <Button
          block
          size="lg"
          withArrow={!draft}
          variant={draft ? 'secondary' : 'primary'}
          onClick={() => void navigate({ to: '/stores' })}
        >
          {t.home.start}
        </Button>
      </div>

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

      <section className={shared.stackTight}>
        <SectionHeader
          title={t.home.recent}
          aside={
            <Link to="/archive" className={styles.viewAll}>
              {t.common.viewAll}
            </Link>
          }
        />
        {recent.length === 0 ? (
          <EmptyState title={t.home.empty} />
        ) : (
          <ul className={shared.list}>
            {recent.map((s) => (
              <li key={s.visit.id}>
                <VisitRow summary={s} />
              </li>
            ))}
          </ul>
        )}
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
      </section>
      <RepSheet open={repSheet} onOpenChange={setRepSheet} />
    </Screen>
  );
}
