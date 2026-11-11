import { useState } from 'react';
import { compareSos } from '@/domain/comparison';
import type { ScopeMetrics, VisitMetrics } from '@/domain/metrics';
import type { SosScope } from '@/domain/sos';
import { formatPct, formatPp } from '@/i18n/format';
import { t } from '@/i18n/strings';
import { InfoIcon } from '@/ui/icons';
import { Segmented } from '@/ui/primitives/Segmented';
import { Badge } from '@/ui/primitives/Text';
import { FacingGrid } from './FacingGrid';
import styles from './results.module.css';

interface LegendItem {
  kind: 'client' | 'competitor' | 'unknown';
  label: string;
  pct: number;
}

function legend(scope: ScopeMetrics): LegendItem[] {
  const client = scope.groups.find((g) => g.kind === 'client');
  const competitors = scope.groups.filter((g) => g.kind === 'competitor');
  const top = competitors[0];
  const rest = scope.groups.filter((g) => g !== client && g !== top);
  const items: LegendItem[] = [];
  if (client) items.push({ kind: 'client', label: client.label, pct: client.sharePct });
  if (top) items.push({ kind: 'competitor', label: top.label, pct: top.sharePct });
  if (rest.length) items.push({ kind: 'unknown', label: t.results.otherUnknown, pct: rest.reduce((n, g) => n + g.sharePct, 0) });
  return items;
}

/** Figma "Share of shelf" summary, per scope, with comparison and category breakdown. */
export function ShareHero({
  metrics,
  previous,
  clientName,
}: {
  metrics: VisitMetrics;
  previous: VisitMetrics | null;
  clientName: string;
}) {
  const initial: SosScope = metrics.scopes.shelf.sos.sharePct !== null ? 'shelf' : 'cooler';
  const [scope, setScope] = useState<SosScope>(initial);
  const [showCategories, setShowCategories] = useState(false);
  const current = metrics.scopes[scope];
  const { sos } = current;
  const comparison = compareSos(metrics, previous, scope);

  return (
    <section className={styles.hero} aria-labelledby="sos-title">
      <div className={styles.heroHead}>
        <h2 id="sos-title" className={styles.heroTitle}>
          {t.results.sos}
        </h2>
        <span className={styles.client}>{clientName}</span>
      </div>
      <Segmented
        label={t.results.sos}
        value={scope}
        onChange={setScope}
        options={(['shelf', 'cooler', 'overall'] as const).map((s) => ({
          value: s,
          label: t.results.scope[s],
          hint: metrics.scopes[s].sos.sharePct === null ? '—' : undefined,
        }))}
      />

      {sos.sharePct === null ? (
        <div className={styles.unavailable} data-testid="sos-value" data-scope={scope}>
          <p className={styles.unavailableTitle}>{t.results.unavailable}</p>
          <p className={styles.reason}>{sos.reasons.map((r) => t.sosReasons[r]).join(' ')}</p>
        </div>
      ) : (
        <>
          <div className={styles.heroValueRow}>
            <p className={styles.heroValue} data-testid="sos-value" data-scope={scope}>
              {formatPct(sos.sharePct)}
            </p>
            <div className={styles.delta}>
              {comparison.deltaPp !== null && (
                <Badge tone={comparison.status === 'comparable' ? 'accent' : 'warning'}>{formatPp(comparison.deltaPp)}</Badge>
              )}
              <span className={styles.deltaLabel}>
                {comparison.status === 'no-previous'
                  ? t.results.firstVisit
                  : comparison.status === 'not-comparable'
                    ? t.results.notComparable
                    : t.results.vsLast}
              </span>
            </div>
          </div>
          <p className={styles.facingsOf}>{t.results.facingsOf(sos.counts.client, sos.counts.eligible)}</p>
          <FacingGrid counts={sos.counts} />
          <ul className={styles.legend}>
            {legend(current).map((item) => (
              <li key={item.label} className={styles.legendItem}>
                <span className={styles.legendLabel}>
                  <span className={styles.swatch} data-kind={item.kind} aria-hidden="true" />
                  {item.label}
                </span>
                <span className={styles.legendValue}>{formatPct(item.pct)}</span>
              </li>
            ))}
          </ul>
          {(sos.status === 'qualified' || comparison.reasons.length > 0) && (
            <div className={styles.qualifiers}>
              <InfoIcon size={14} />
              <span>
                {sos.status === 'qualified' && (
                  <>
                    <strong>{t.results.qualified}: </strong>
                    {sos.reasons.map((r) => t.sosReasons[r]).join('; ')}.{' '}
                  </>
                )}
                {comparison.reasons
                  .filter((r) => r !== 'measure-qualified')
                  .map((r) => t.comparisonReasons[r])
                  .join('; ')}
              </span>
            </div>
          )}
          {current.categories.length > 0 && (
            <div>
              <button
                type="button"
                className={styles.toggle}
                aria-expanded={showCategories}
                onClick={() => setShowCategories((v) => !v)}
              >
                {t.results.byCategory} {showCategories ? '−' : '+'}
              </button>
              {showCategories && (
                <ul className={styles.categories}>
                  {current.categories.map((c) => (
                    <li key={c.category} className={styles.categoryRow}>
                      <span>{t.categories[c.category]}</span>
                      <span className={styles.bar} aria-hidden="true">
                        <span style={{ width: `${c.sharePct ?? 0}%` }} />
                      </span>
                      <span className={styles.legendValue}>
                        {c.sharePct === null ? '—' : formatPct(c.sharePct)}
                        <span className={styles.categoryCount}>
                          {' '}
                          {c.counts.client}/{c.counts.eligible}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
