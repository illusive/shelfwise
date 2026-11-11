import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useInvalidate, useVisitDetail } from '@/app/data';
import { useServices } from '@/app/services-context';
import { isJobActive, type JobStatus } from '@/domain/models';
import { formatAddress } from '@/i18n/format';
import { t } from '@/i18n/strings';
import { AlertIcon, CheckIcon, RefreshIcon } from '@/ui/icons';
import { Button } from '@/ui/primitives/Button';
import { Screen, TopBar } from '@/ui/primitives/Screen';
import { EmptyState, Eyebrow, Mono, Notice } from '@/ui/primitives/Text';
import shared from '../shared/shared.module.css';
import styles from './ProcessingPage.module.css';

type StepState = 'done' | 'active' | 'waiting' | 'failed';

const ORDER: JobStatus[] = ['queued', 'preparing', 'analysing', 'completed'];

function stepState(step: JobStatus, current: JobStatus, failedAt: JobStatus | null): StepState {
  if (current === 'failed')
    return step === failedAt
      ? 'failed'
      : ORDER.indexOf(step) < ORDER.indexOf(failedAt ?? 'queued')
        ? 'done'
        : 'waiting';
  const s = ORDER.indexOf(step);
  const c = ORDER.indexOf(current);
  return s < c || current === 'completed' ? 'done' : s === c ? 'active' : 'waiting';
}

export function ProcessingPage({ visitId }: { visitId: string }) {
  const navigate = useNavigate();
  const services = useServices();
  const invalidate = useInvalidate();
  const { data: detail, isPending } = useVisitDetail(visitId);
  const [acting, setActing] = useState(false);

  const completed = detail?.visit.status === 'completed';
  useEffect(() => {
    if (completed)
      void navigate({ to: '/visits/$visitId/results', params: { visitId }, replace: true });
  }, [completed, navigate, visitId]);

  if (isPending) return null;
  if (!detail)
    return (
      <Screen>
        <EmptyState title={t.common.notFound} />
      </Screen>
    );
  const { visit, store, job, captures } = detail;

  if (visit.status === 'draft' || !job) {
    return (
      <Screen>
        <TopBar
          title={t.processing.title}
          onBack={() => void navigate({ to: '/stores/$storeId', params: { storeId: store.id } })}
        />
        <EmptyState title={t.store.inProgress} />
      </Screen>
    );
  }

  const failed = job.status === 'failed';
  const preparationFailure = ['no-photos', 'photo-missing', 'visit-missing'].includes(
    job.failure?.code ?? '',
  );
  const failedAt: JobStatus | null = failed
    ? preparationFailure
      ? 'preparing'
      : 'analysing'
    : null;
  const steps: { status: JobStatus; label: string; detail?: string }[] = [
    {
      status: 'queued',
      label: job.status === 'queued' ? t.processing.status.queued : t.processing.submitted,
    },
    {
      status: 'preparing',
      label: t.processing.status.preparing,
      detail: job.progress
        ? t.processing.preparing(job.progress.done, job.progress.total)
        : t.counts.photos(captures.length),
    },
    { status: 'analysing', label: t.processing.status.analysing, detail: job.providerId },
  ];

  const act = async (task: () => Promise<unknown>) => {
    setActing(true);
    try {
      await task();
      await invalidate();
    } finally {
      setActing(false);
    }
  };
  const retry = () => act(() => services.analysis.retry(job.id));
  const edit = () =>
    act(async () => {
      await services.captures.reopenDraft(visit.id);
      await navigate({ to: '/visits/$visitId/captures', params: { visitId } });
    });

  return (
    <Screen
      action={
        failed ? (
          <div className={shared.stack}>
            {job.failure?.retryable && (
              <Button
                block
                size="lg"
                icon={<RefreshIcon size={18} />}
                disabled={acting}
                onClick={() => void retry()}
              >
                {t.processing.retry}
              </Button>
            )}
            <Button block variant="secondary" disabled={acting} onClick={() => void edit()}>
              {t.processing.edit}
            </Button>
          </div>
        ) : undefined
      }
    >
      <TopBar
        title={t.processing.title}
        onBack={() => void navigate({ to: '/stores/$storeId', params: { storeId: store.id } })}
      />
      <Eyebrow steps={{ current: 3, total: 3 }}>{t.processing.eyebrow}</Eyebrow>
      <div className={shared.stackTight}>
        <h1 className={shared.storeTitle}>{store.name}</h1>
        <p className={shared.muted}>
          {formatAddress(store.address)} · {t.counts.photos(captures.length)}
        </p>
        <Mono>
          {t.processing.job(job.id)} · {t.processing.attempts(Math.max(1, job.attempts))}
        </Mono>
      </div>

      <ol
        className={styles.steps}
        aria-live="polite"
        data-testid="job-status"
        data-status={job.status}
      >
        {steps.map((step) => {
          const state = stepState(step.status, job.status, failedAt);
          return (
            <li key={step.status} className={styles.step} data-state={state}>
              <span className={styles.marker} aria-hidden="true">
                {state === 'done' ? (
                  <CheckIcon size={14} />
                ) : state === 'failed' ? (
                  <AlertIcon size={14} />
                ) : null}
                {state === 'active' && <span className={styles.spinner} />}
              </span>
              <span className={styles.stepBody}>
                <span className={styles.stepLabel}>{step.label}</span>
                {step.detail && state !== 'waiting' && <Mono>{step.detail}</Mono>}
              </span>
            </li>
          );
        })}
      </ol>

      {isJobActive(job.status) && <p className={shared.muted}>{t.processing.analysingHint}</p>}
      {failed && (
        <Notice tone="danger" title={t.processing.status.failed}>
          {t.failures[job.failure?.code ?? ''] ?? job.failure?.message} {t.processing.failedHint}
        </Notice>
      )}
      {services.analysis.providerSource === 'mock' && (
        <Notice tone="info" title={t.common.mockLong}>
          {t.processing.mockNote}
        </Notice>
      )}
    </Screen>
  );
}
