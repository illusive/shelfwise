import { Link, useNavigate } from '@tanstack/react-router';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { useVisitDetail } from '@/app/data';
import type { Capture } from '@/domain/models';
import { formatLongDay, formatTime, padSequence } from '@/i18n/format';
import { t } from '@/i18n/strings';
import { CameraIcon, CloseIcon, PlusIcon, RefreshIcon, TrashIcon } from '@/ui/icons';
import { BlobImage } from '@/ui/primitives/BlobImage';
import { Button, IconButton } from '@/ui/primitives/Button';
import { Screen, TopBar } from '@/ui/primitives/Screen';
import { Sheet } from '@/ui/primitives/Sheet';
import { EmptyState, Eyebrow, Mono, Notice, SectionHeader } from '@/ui/primitives/Text';
import shared from '../shared/shared.module.css';
import { useVisitActions } from '../visit/useVisitActions';
import { ImportPhotos } from './ImportPhotos';
import styles from './CapturesPage.module.css';

export function CapturesPage({ visitId }: { visitId: string }) {
  const navigate = useNavigate();
  const { data: detail, isPending } = useVisitDetail(visitId);
  const actions = useVisitActions();
  const [inspect, setInspect] = useState<Capture | null>(null);

  if (isPending) return null;
  if (!detail) return <Screen><EmptyState title={t.common.notFound} /></Screen>;

  const { visit, store, captures } = detail;
  const tz = store.timeZone;
  const editable = visit.status === 'draft';
  const toCamera = () => void navigate({ to: '/visits/$visitId/camera', params: { visitId } });

  return (
    <Screen
      action={
        editable ? (
          <Button
            block
            size="lg"
            withArrow
            disabled={captures.length === 0 || actions.submitting}
            onClick={() => void actions.submit(visitId)}
          >
            {t.store.analyse(captures.length)}
          </Button>
        ) : undefined
      }
    >
      <TopBar
        title={t.captures.title}
        onBack={() => void navigate({ to: '/stores/$storeId', params: { storeId: store.id } })}
      />
      <Eyebrow steps={{ current: 2, total: 3 }}>{t.captures.eyebrow}</Eyebrow>
      <div className={shared.stackTight}>
        <h1 className={shared.displayTitle}>{t.captures.heading}</h1>
        <Mono>{formatLongDay(visit.createdAt, tz).toUpperCase()}</Mono>
        <p className={shared.muted} data-testid="captures-store">
          {store.name} · {store.address.street}
        </p>
      </div>

      {!editable && (
        <Notice
          tone="info"
          title={t.store.processing}
          action={
            <Link to="/visits/$visitId/processing" params={{ visitId }}>
              {t.processing.title} →
            </Link>
          }
        />
      )}

      <section className={shared.stack}>
        <SectionHeader
          title={<span data-testid="captures-count">{t.captures.count(captures.length)}</span>}
          aside={editable && captures.length > 0 ? t.captures.removeHint : undefined}
        />
        {captures.length === 0 ? (
          <EmptyState icon={<CameraIcon size={28} />} title={t.captures.empty}>
            {t.captures.emptyHint}
          </EmptyState>
        ) : (
          <ul className={styles.grid}>
            <AnimatePresence initial={false}>
              {captures.map((c) => (
                <motion.li
                  key={c.id}
                  layout
                  className={styles.item}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.18 }}
                >
                  <button type="button" className={styles.imageButton} onClick={() => setInspect(c)}>
                    <BlobImage
                      blobId={c.thumbBlobId}
                      fallbackBlobId={c.blobId}
                      alt={t.store.capture(padSequence(c.sequence))}
                      className={styles.image}
                    />
                  </button>
                  {editable && (
                    <IconButton
                      label={t.captures.remove(padSequence(c.sequence))}
                      tone="light"
                      className={styles.remove}
                      onClick={() => void actions.removeCapture(c.id)}
                    >
                      <CloseIcon size={18} />
                    </IconButton>
                  )}
                  <span className={styles.label}>{t.store.capture(padSequence(c.sequence))}</span>
                  <Mono>
                    {formatTime(c.capturedAt, tz)}
                    {c.source === 'import' ? ` · ${t.captures.imported}` : ''}
                  </Mono>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
        {editable && (
          <>
            <Button variant="secondary" block icon={<PlusIcon size={18} />} onClick={toCamera}>
              {t.captures.add}
            </Button>
            <ImportPhotos resolveVisitId={async () => visitId} onImport={actions.importFiles} />
          </>
        )}
      </section>

      <Sheet
        open={inspect !== null}
        onOpenChange={(open) => !open && setInspect(null)}
        title={inspect ? t.store.capture(padSequence(inspect.sequence)) : ''}
      >
        {inspect && (
          <>
            <BlobImage blobId={inspect.blobId} alt={t.store.capture(padSequence(inspect.sequence))} className={styles.full} fit="contain" />
            {editable && (
              <div className={shared.spread}>
                <Button
                  variant="secondary"
                  icon={<RefreshIcon size={18} />}
                  onClick={() =>
                    void navigate({
                      to: '/visits/$visitId/retake/$captureId',
                      params: { visitId, captureId: inspect.id },
                    })
                  }
                >
                  {t.camera.retake}
                </Button>
                <Button
                  variant="danger"
                  icon={<TrashIcon size={18} />}
                  onClick={() => {
                    void actions.removeCapture(inspect.id);
                    setInspect(null);
                  }}
                >
                  {t.camera.remove}
                </Button>
              </div>
            )}
          </>
        )}
      </Sheet>
    </Screen>
  );
}
