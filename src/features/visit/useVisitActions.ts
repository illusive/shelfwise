import { useNavigate } from '@tanstack/react-router';
import { useCallback, useState } from 'react';
import { useInvalidate } from '@/app/data';
import { useServices } from '@/app/services-context';
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

  const removeCapture = useCallback(
    async (captureId: string) => {
      await services.captures.removeCapture(captureId);
      await invalidate();
      toast(t.captures.removed);
    },
    [services, invalidate, toast],
  );

  return { startVisit, importFiles, submit, submitting, removeCapture };
}
