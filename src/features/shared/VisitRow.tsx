import { Link } from '@tanstack/react-router';
import { isJobActive } from '@/domain/models';
import { formatPct, formatRelativeDay, formatTime } from '@/i18n/format';
import { t } from '@/i18n/strings';
import type { VisitSummary } from '@/services/visitSummaries';
import { ChevronRightIcon } from '@/ui/icons';
import { BlobImage } from '@/ui/primitives/BlobImage';
import { Badge, MockBadge } from '@/ui/primitives/Text';
import shared from './shared.module.css';
import styles from './VisitRow.module.css';

export type VisitRowTitle = 'store' | 'date';

function locationSummary(summary: VisitSummary): string {
  const { metrics } = summary;
  if (!metrics) return t.counts.photos(summary.captureCount);
  const { shelf, cooler } = metrics.coverage.locations;
  const parts: string[] = [];
  if (shelf) parts.push(t.counts.shelves(shelf));
  if (cooler) parts.push(t.counts.coolers(cooler));
  return parts.join(' · ') || t.counts.photos(summary.captureCount);
}

/** Visit list row shared by Home, Store and Archive (Figma "Recent visits" row). */
export function VisitRow({
  summary,
  title = 'store',
}: {
  summary: VisitSummary;
  title?: VisitRowTitle;
}) {
  const { visit, store, metrics, job } = summary;
  const when = visit.completedAt ?? visit.submittedAt ?? visit.createdAt;
  const tz = store.timeZone;
  const day = formatRelativeDay(when, tz);
  const share = metrics?.scopes.overall.sos.sharePct ?? null;

  const status =
    visit.status === 'draft' ? (
      <Badge tone="neutral">{t.archive.draft}</Badge>
    ) : job && isJobActive(job.status) ? (
      <Badge tone="warning">{t.archive.processing}</Badge>
    ) : job?.status === 'failed' ? (
      <Badge tone="danger">{t.archive.failed}</Badge>
    ) : null;

  const content = (
    <>
      <BlobImage
        blobId={summary.cover?.thumbBlobId}
        fallbackBlobId={summary.cover?.blobId}
        alt=""
        className={styles.thumb}
      />
      <div className={styles.body}>
        <p className={styles.title}>{title === 'store' ? store.name : day}</p>
        <p className={styles.sub}>
          {title === 'store'
            ? `${store.area} · ${locationSummary(summary)}`
            : locationSummary(summary)}
        </p>
        <p className={styles.meta}>
          {title === 'store'
            ? `${day} · ${formatTime(when, tz)}`
            : `${formatTime(when, tz)} · ${t.counts.photos(summary.captureCount)}`}
        </p>
      </div>
      <div className={styles.value}>
        {status ?? (
          <>
            <span className={styles.pct}>{share === null ? '—' : formatPct(share)}</span>
            <span className={styles.pctLabel}>{t.common.shelfShare}</span>
            {metrics && <MockBadge source={metrics.source} />}
          </>
        )}
      </div>
      <ChevronRightIcon size={18} className={shared.chevron} />
    </>
  );

  if (visit.status === 'draft') {
    return (
      <Link to="/stores/$storeId" params={{ storeId: store.id }} className={styles.row}>
        {content}
      </Link>
    );
  }
  if (visit.status === 'submitted') {
    return (
      <Link to="/visits/$visitId/processing" params={{ visitId: visit.id }} className={styles.row}>
        {content}
      </Link>
    );
  }
  return (
    <Link to="/visits/$visitId/results" params={{ visitId: visit.id }} className={styles.row}>
      {content}
    </Link>
  );
}
