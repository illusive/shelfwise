import { useNavigate } from '@tanstack/react-router';
import { useCallback, useState } from 'react';
import { useInvalidate } from '@/app/data';
import { useServices } from '@/app/services-context';
import { padSequence } from '@/i18n/format';
import { t } from '@/i18n/strings';
import { useToast } from '@/ui/primitives/Toast';

/** Visit-level commands shared by the store hub, captures review and camera. */
export function useVisitActions() {
  const services = useServices();
  const invalidate = useInvalidate();
  const navigate = useNavigate();
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);

  const startVisit = useCallback(
    async (storeId: string, repId: string) => {
      const visit = await services.captures.startVisit(storeId, repId);
      await invalidate();
      return visit;
    },
    [services, invalidate],
  );

  const importFiles = useCallback(
    async (visitId: string, files: File[]) => {
      let saved = 0;
      for (const file of files) {
        if (!file.type.startsWith('image/')) continue;
        try {
          // lastModified is the closest available capture time for imported photos.
          await services.captures.addCapture(visitId, {
            blob: file,
            source: 'import',
            capturedAt: file.lastModified ? new Date(file.lastModified) : undefined,
          });
          saved += 1;
        } catch {
          toast(t.camera.saveFailed, 'danger');
        }
      }
      await invalidate();
      return saved;
    },
    [services, invalidate, toast],
  );

  const submit = useCallback(
    async (visitId: string) => {
      if (submitting) return;
      setSubmitting(true);
      try {
        await services.analysis.submitVisit(visitId);
        await invalidate();
        await navigate({ to: '/visits/$visitId/processing', params: { visitId } });
      } catch (e) {
        toast(e instanceof Error ? e.message : String(e), 'danger');
      } finally {
        setSubmitting(false);
      }
    },
    [services, invalidate, navigate, toast, submitting],
  );

  /** Removes immediately; the toast offers Undo until it expires, then the images are purged. */
  const removeCapture = useCallback(
    async (captureId: string) => {
      const removed = await services.captures.removeCapture(captureId);
      await invalidate();
      if (!removed) return;
      toast(t.captures.removed(padSequence(removed.sequence)), {
        action: {
          label: t.common.undo,
          onClick: () => {
            services.captures
              .restoreCapture(removed)
              .then(invalidate)
              .catch(() => toast(t.captures.restoreFailed, 'danger'));
          },
        },
        onExpire: () => void services.captures.purgeRemoved(removed),
      });
    },
    [services, invalidate, toast],
  );

  const discardDraft = useCallback(
    async (visitId: string, storeId: string) => {
      await services.captures.discardDraft(visitId);
      await invalidate();
      toast(t.store.discarded);
      await navigate({ to: '/stores/$storeId', params: { storeId } });
    },
    [services, invalidate, navigate, toast],
  );

  return { startVisit, importFiles, submit, submitting, removeCapture, discardDraft };
}
