import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useCurrentRep, useVisitSummaries } from '@/app/data';
import { localDateKey } from '@/i18n/format';
import { t } from '@/i18n/strings';
import type { VisitSummary } from '@/services/visitSummaries';
import { ChevronDownIcon, ChevronRightIcon, SearchIcon } from '@/ui/icons';
import { Screen, Wordmark } from '@/ui/primitives/Screen';
import { EmptyState } from '@/ui/primitives/Text';
import shared from '../shared/shared.module.css';
import { VisitRow } from '../shared/VisitRow';
import { matchesStore } from '../stores/search';
import styles from './ArchivePage.module.css';

type Period = 'month' | '30d' | 'all';

function inPeriod(summary: VisitSummary, period: Period, now: Date): boolean {
  if (period === 'all') return true;
  const when = summary.visit.completedAt ?? summary.visit.submittedAt ?? summary.visit.createdAt;
  if (period === '30d') return now.getTime() - new Date(when).getTime() <= 30 * 86_400_000;
  const tz = summary.store.timeZone;
  return localDateKey(when, tz).slice(0, 7) === localDateKey(now.toISOString(), tz).slice(0, 7);
}

export function ArchivePage() {
  const { data: rep } = useCurrentRep();
  const { data: summaries = [] } = useVisitSummaries({ repId: rep?.id });
  const [query, setQuery] = useState('');
  const [storeId, setStoreId] = useState('all');
  const [period, setPeriod] = useState<Period>('month');
  const now = new Date();

  const visits = summaries.filter((s) => s.visit.status !== 'draft');
  const storeOptions = [...new Map(visits.map((s) => [s.store.id, s.store])).values()].sort(
    (a, b) => a.name.localeCompare(b.name, 'da-DK'),
  );
  const filtered = visits.filter(
    (s) =>
      (storeId === 'all' || s.store.id === storeId) &&
      matchesStore(s.store, query) &&
      inPeriod(s, period, now),
  );
  const groups = new Map<string, VisitSummary[]>();
  for (const s of filtered) groups.set(s.store.id, [...(groups.get(s.store.id) ?? []), s]);

  return (
    <Screen nav>
      <Wordmark />
      <div className={shared.stackTight}>
        <h1 className={shared.displayTitle}>{t.archive.title}</h1>
        <p className={shared.muted}>{t.archive.subtitle}</p>
      </div>
      <label className={shared.searchField}>
        <SearchIcon size={18} />
        <span className="visually-hidden">{t.archive.search}</span>
        <input
          type="search"
          value={query}
          placeholder={t.archive.search}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <div className={styles.filters}>
        <label className={shared.selectWrap}>
          <span className="visually-hidden">{t.archive.allStores}</span>
          <select
            className={`${shared.select} ${shared.selectDark}`}
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
          >
            <option value="all">{t.archive.allStores}</option>
            {storeOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.address.street}
              </option>
            ))}
          </select>
          <ChevronDownIcon size={16} className={shared.selectIcon} />
        </label>
        <label className={shared.selectWrap}>
          <span className="visually-hidden">Period</span>
          <select
            className={shared.select}
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
          >
            {(Object.keys(t.archive.period) as Period[]).map((p) => (
              <option key={p} value={p}>
                {t.archive.period[p]}
              </option>
            ))}
          </select>
          <ChevronDownIcon size={16} className={shared.selectIcon} />
        </label>
      </div>
      <p className={shared.muted}>{t.archive.summary(filtered.length, groups.size)}</p>

      {groups.size === 0 ? (
        <EmptyState title={t.archive.empty} />
      ) : (
        [...groups.values()].map((items) => {
          const store = items[0].store;
          return (
            <section key={store.id} className={styles.group}>
              <Link
                to="/stores/$storeId"
                params={{ storeId: store.id }}
                className={styles.groupHead}
              >
                <span className={styles.groupTitle}>{store.name}</span>
                <ChevronRightIcon size={18} className={shared.chevron} />
              </Link>
              <p className={shared.muted}>
                {store.address.street} · {t.archive.visitsInPeriod(items.length)}
              </p>
              <ul className={shared.list}>
                {items.map((s) => (
                  <li key={s.visit.id}>
                    <VisitRow summary={s} title="date" />
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
      <p className={shared.footnote}>{t.archive.footer}</p>
    </Screen>
  );
}
