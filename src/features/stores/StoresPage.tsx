import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useCurrentRep, useStores, useVisitSummaries } from '@/app/data';
import type { Store } from '@/domain/models';
import { formatRelativeDay } from '@/i18n/format';
import { t } from '@/i18n/strings';
import { ChevronRightIcon, SearchIcon } from '@/ui/icons';
import { Screen } from '@/ui/primitives/Screen';
import { AppHeader } from '../session/AppHeader';
import { EmptyState, SectionHeader } from '@/ui/primitives/Text';
import shared from '../shared/shared.module.css';
import { matchesStore } from './search';
import styles from './stores.module.css';

export function StoresPage() {
  const { data: rep } = useCurrentRep();
  const { data: stores = [] } = useStores();
  const { data: summaries = [] } = useVisitSummaries({ repId: rep?.id });
  const [query, setQuery] = useState('');

  const lastVisit = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of summaries) {
      if (s.visit.status !== 'completed' || !s.visit.completedAt) continue;
      const prev = map.get(s.store.id);
      if (!prev || prev < s.visit.completedAt) map.set(s.store.id, s.visit.completedAt);
    }
    return map;
  }, [summaries]);
  const drafts = new Set(
    summaries.filter((s) => s.visit.status === 'draft').map((s) => s.store.id),
  );

  const sorted = [...stores].sort((a, b) => a.name.localeCompare(b.name, 'da-DK'));
  const assigned = sorted.filter((s) => rep && s.assignedRepIds.includes(rep.id));
  const searching = query.trim().length > 0;
  const results = sorted.filter((s) => matchesStore(s, query));

  const renderList = (list: Store[]) => (
    <ul className={shared.list}>
      {list.map((store) => {
        const last = lastVisit.get(store.id);
        return (
          <li key={store.id}>
            <Link to="/stores/$storeId" params={{ storeId: store.id }} className={styles.storeRow}>
              <span className={styles.chain} aria-hidden="true">
                {store.chain.slice(0, 2)}
              </span>
              <span className={styles.storeBody}>
                <span className={styles.storeName}>{store.name}</span>
                <span className={styles.storeAddress}>
                  {store.address.street} · {store.address.postcode} {store.address.city}
                </span>
                <span className={styles.storeMeta}>
                  {t.stores.customerNo(store.customerNumber)} ·{' '}
                  {drafts.has(store.id)
                    ? t.store.inProgress
                    : last
                      ? t.stores.lastVisit(formatRelativeDay(last, store.timeZone))
                      : t.stores.neverVisited}
                </span>
              </span>
              <ChevronRightIcon size={18} className={shared.chevron} />
            </Link>
          </li>
        );
      })}
    </ul>
  );

  return (
    <Screen nav>
      <AppHeader />
      <h1 className={shared.displayTitle}>{t.stores.title}</h1>
      <label className={shared.searchField}>
        <SearchIcon size={18} />
        <span className="visually-hidden">{t.stores.search}</span>
        <input
          type="search"
          value={query}
          placeholder={t.stores.search}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
          enterKeyHint="search"
        />
      </label>
      {searching ? (
        <section className={shared.stackTight}>
          <SectionHeader title={t.stores.all} aside={t.stores.results(results.length)} />
          {results.length ? renderList(results) : <EmptyState title={t.stores.none} />}
        </section>
      ) : (
        <>
          <section className={shared.stackTight}>
            <SectionHeader title={t.stores.assigned} aside={assigned.length} />
            {renderList(assigned)}
          </section>
          <section className={shared.stackTight}>
            <SectionHeader title={t.stores.all} aside={sorted.length} />
            {renderList(sorted.filter((s) => !assigned.includes(s)))}
          </section>
        </>
      )}
    </Screen>
  );
}
