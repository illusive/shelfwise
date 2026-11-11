import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useVisitDetail } from '@/app/data';
import { formatLongDay } from '@/i18n/format';
import { t } from '@/i18n/strings';
import { CameraIcon, PlusIcon } from '@/ui/icons';
import { Button } from '@/ui/primitives/Button';
import { Screen } from '@/ui/primitives/Screen';
import { EmptyState, Notice, SectionHeader } from '@/ui/primitives/Text';
import { PageTitle } from '../shared/PageTitle';
import shared from '../shared/shared.module.css';
import { StoreHeader } from '../shared/StoreHeader';
import { SubmitBar } from '../visit/SubmitBar';
import { useVisitActions } from '../visit/useVisitActions';
import { ImportPhotos } from './ImportPhotos';
import { Lightbox } from './Lightbox';
import { PhotoWall } from './PhotoWall';

export function CapturesPage({ visitId }: { visitId: string }) {
  const navigate = useNavigate();
  const { data: detail, isPending } = useVisitDetail(visitId);
  const actions = useVisitActions();
  const [openId, setOpenId] = useState<string | null>(null);

  if (isPending) return null;
  if (!detail)
    return (
      <Screen>
        <EmptyState title={t.common.notFound} />
      </Screen>
    );

  const { visit, store, captures } = detail;
  const tz = store.timeZone;
  const editable = visit.status === 'draft';
  const toCamera = () => void navigate({ to: '/visits/$visitId/camera', params: { visitId } });

  return (
    <Screen
      header={
        <StoreHeader
          store={store}
          onBack={() => void navigate({ to: '/stores/$storeId', params: { storeId: store.id } })}
        />
      }
      action={
        editable ? (
          <SubmitBar
            photoCount={captures.length}
            submitting={actions.submitting}
            onSubmit={() => actions.submit(visitId)}
            onDiscard={() => actions.discardDraft(visitId, store.id)}
          />
        ) : undefined
      }
    >
      <PageTitle
        title={t.captures.heading}
        sub={formatLongDay(visit.createdAt, tz).toUpperCase()}
      />

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
          <PhotoWall
            captures={captures}
            timeZone={tz}
            editable={editable}
            onOpen={(c) => setOpenId(c.id)}
            onRemove={(c) => void actions.removeCapture(c.id)}
          />
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

      <Lightbox
        captures={captures}
        openId={openId}
        timeZone={tz}
        editable={editable}
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
