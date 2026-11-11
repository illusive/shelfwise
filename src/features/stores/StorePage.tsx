import { Link, useNavigate } from '@tanstack/react-router';
import { useState, type ReactNode } from 'react';
import { useCurrentRep, useStore, useVisitDetail, useVisitSummaries } from '@/app/data';
import {
  formatPct,
  formatRelativeDay,
  formatTime,
  padSequence,
  formatAddress,
} from '@/i18n/format';
import { t } from '@/i18n/strings';
import type { VisitSummary } from '@/services/visitSummaries';
import { CameraIcon, CheckIcon, ChevronRightIcon, LockIcon, PlusIcon } from '@/ui/icons';
import { BlobImage } from '@/ui/primitives/BlobImage';
import { Button } from '@/ui/primitives/Button';
import { Screen, TopBar } from '@/ui/primitives/Screen';
import { EmptyState, Eyebrow, MockBadge, Notice, SectionHeader } from '@/ui/primitives/Text';
import { ImportPhotos } from '../capture/ImportPhotos';
import { Lightbox } from '../capture/Lightbox';
import { PhotoWall } from '../capture/PhotoWall';
import { SubmitBar } from '../visit/SubmitBar';
import shared from '../shared/shared.module.css';
import { VisitRow } from '../shared/VisitRow';
import { useVisitActions } from '../visit/useVisitActions';
import styles from './stores.module.css';

export function StorePage({ storeId }: { storeId: string }) {
  const navigate = useNavigate();
  const { data: rep } = useCurrentRep();
  const { data: store, isPending } = useStore(storeId);
  const { data: summaries = [] } = useVisitSummaries({ storeId });
  const actions = useVisitActions();

  if (isPending || !rep) return null;
  if (!store)
    return (
      <Screen nav>
        <EmptyState title={t.common.notFound} />
      </Screen>
    );

  const draft = summaries.find((s) => s.visit.status === 'draft' && s.visit.repId === rep.id);

  const begin = async () => {
    const visit = await actions.startVisit(store.id, rep.id);
    await navigate({ to: '/visits/$visitId/camera', params: { visitId: visit.id } });
  };
  const resolveVisitId = async () =>
    draft ? draft.visit.id : (await actions.startVisit(store.id, rep.id)).id;

  const header = (
    <>
      <TopBar
        title={t.store.title}
        subtitle={t.store.subtitle}
        onBack={() => void navigate({ to: '/' })}
      />
      <Eyebrow steps={{ current: 1, total: 3 }}>{t.store.eyebrow}</Eyebrow>
      <div className={shared.stackTight}>
        <h1 className={shared.storeTitle} data-testid="store-name">
          {store.name}
        </h1>
        <p className={shared.muted}>{formatAddress(store.address)}</p>
        <div className={shared.spread}>
          <span className={styles.status}>
            <span className={`${styles.dot} ${draft ? '' : styles.dotIdle}`} />
            {draft ? t.store.inProgress : t.store.noVisit}
          </span>
          <Link to="/stores" className={styles.changeStore}>
            {t.store.change}
          </Link>
        </div>
      </div>
    </>
  );

  if (draft) {
    return (
      <DraftHub
        header={header}
        visitId={draft.visit.id}
        storeId={store.id}
        timeZone={store.timeZone}
      />
    );
  }

  const completed = summaries.filter((s) => s.visit.status === 'completed');
  const pending = summaries.filter((s) => s.visit.status === 'submitted');

  return (
    <Screen
      action={
        <div className={shared.stack}>
          <Button block size="lg" withArrow onClick={() => void begin()}>
            {t.store.start}
          </Button>
        </div>
      }
    >
      {header}
      {pending.map((s) => (
        <Notice
          key={s.visit.id}
          tone={s.job?.status === 'failed' ? 'danger' : 'info'}
          title={s.job?.status === 'failed' ? t.processing.status.failed : t.store.processing}
          action={
            <Link
              to="/visits/$visitId/processing"
              params={{ visitId: s.visit.id }}
              className={styles.changeStore}
            >
              {t.common.viewAll} →
            </Link>
          }
        />
      ))}
      {completed[0] ? <LatestResult summary={completed[0]} /> : null}
      <section className={shared.stackTight}>
        <SectionHeader title={t.store.history} aside={completed.length || undefined} />
        {completed.length === 0 ? (
          <EmptyState icon={<CameraIcon size={28} />} title={t.store.noVisits}>
            {t.store.noVisitsHint}
          </EmptyState>
        ) : (
          <ul className={shared.list}>
            {completed.map((s) => (
              <li key={s.visit.id}>
                <VisitRow summary={s} title="date" />
              </li>
            ))}
          </ul>
        )}
      </section>
      <ImportPhotos resolveVisitId={resolveVisitId} onImport={actions.importFiles} />
    </Screen>
  );
}

function LatestResult({ summary }: { summary: VisitSummary }) {
  const { metrics, visit, store } = summary;
  if (!metrics) return null;
  const share = (pct: number | null) => (pct === null ? '—' : formatPct(pct));
  return (
    <Link
      to="/visits/$visitId/results"
      params={{ visitId: visit.id }}
      className={`${shared.card} ${styles.latest}`}
    >
      <div className={shared.spread}>
        <SectionHeader title={t.store.latest} />
        <MockBadge source={metrics.source} />
      </div>
      <div className={shared.spread}>
        <div className={shared.stackTight}>
          <span className={styles.latestShare}>{share(metrics.scopes.overall.sos.sharePct)}</span>
          <span className={shared.muted}>
            {t.common.shelfShare} · {formatRelativeDay(visit.completedAt!, store.timeZone)}{' '}
            {formatTime(visit.completedAt!, store.timeZone)}
          </span>
        </div>
        <ChevronRightIcon className={shared.chevron} />
      </div>
      <div className={styles.latestScopes}>
        {(['shelf', 'cooler'] as const).map((scope) => (
          <div key={scope} className={shared.stackTight}>
            <span className={shared.muted}>{t.results.scope[scope]}</span>
            <span className={styles.scopeValue}>{share(metrics.scopes[scope].sos.sharePct)}</span>
          </div>
        ))}
      </div>
    </Link>
  );
}

function DraftHub({
  header,
  visitId,
  storeId,
  timeZone,
}: {
  header: ReactNode;
  visitId: string;
  storeId: string;
  timeZone: string;
}) {
  const navigate = useNavigate();
  const actions = useVisitActions();
  const { data: detail } = useVisitDetail(visitId);
  const [openId, setOpenId] = useState<string | null>(null);
  const captures = detail?.captures ?? [];
  const only = captures.length === 1 ? captures[0] : undefined;
  const toCamera = () => void navigate({ to: '/visits/$visitId/camera', params: { visitId } });

  return (
    <Screen
      action={
        <SubmitBar
          photoCount={captures.length}
          submitting={actions.submitting}
          onSubmit={() => actions.submit(visitId)}
          onDiscard={() => actions.discardDraft(visitId, storeId)}
        />
      }
    >
      {header}
      <section className={shared.stack}>
        <SectionHeader
          title={t.store.captures}
          aside={<span data-testid="captures-count">{t.captures.count(captures.length)}</span>}
        />
        {only ? (
          <>
            <button
              type="button"
              className={styles.lead}
              aria-label={t.captures.open(padSequence(only.sequence))}
              onClick={() => setOpenId(only.id)}
            >
              <BlobImage
                blobId={only.thumbBlobId}
                fallbackBlobId={only.blobId}
                alt=""
                className={styles.leadImage}
              />
              <span className={styles.chip}>{padSequence(only.sequence)}</span>
            </button>
            <div className={shared.spread}>
              <div className={shared.stackTight}>
                <span className={styles.guideTitle}>
                  {t.store.capture(padSequence(only.sequence))}
                </span>
                <span className={shared.muted}>
                  {formatRelativeDay(only.capturedAt, timeZone)} ·{' '}
                  {formatTime(only.capturedAt, timeZone)}
                </span>
              </div>
              <span className={styles.status}>
                <CheckIcon size={14} /> {t.store.readyToAnalyse}
              </span>
            </div>
          </>
        ) : captures.length > 1 ? (
          <PhotoWall
            captures={captures}
            timeZone={timeZone}
            editable
            onOpen={(c) => setOpenId(c.id)}
            onRemove={(c) => void actions.removeCapture(c.id)}
          />
        ) : (
          <EmptyState icon={<CameraIcon size={28} />} title={t.captures.empty}>
            {t.captures.emptyHint}
          </EmptyState>
        )}
        <Button variant="secondary" block icon={<PlusIcon size={18} />} onClick={toCamera}>
          {captures.length ? t.store.addPhoto : t.store.takePhotos}
        </Button>
        <ImportPhotos resolveVisitId={async () => visitId} onImport={actions.importFiles} />
      </section>
      <p className={shared.footnote}>
        <LockIcon size={14} /> {t.store.privacy}
      </p>
      <Lightbox
        captures={captures}
        openId={openId}
        timeZone={timeZone}
        editable
        onOpenChange={setOpenId}
        onRetake={(c) =>
          void navigate({
            to: '/visits/$visitId/retake/$captureId',
            params: { visitId, captureId: c.id },
          })
        }
        onRemove={(c) => {
          setOpenId(null);
          void actions.removeCapture(c.id);
        }}
      />
    </Screen>
  );
}
