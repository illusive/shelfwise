import { useState } from 'react';
import { BUILD } from '@/app/build';
import { useExportableVisits } from '@/app/data';
import { useServices } from '@/app/services-context';
import { useHoldUpdates } from '@/app/updateGate';
import { formatLongDay, formatTime } from '@/i18n/format';
import { t } from '@/i18n/strings';
import { downloadBlob } from '@/ui/download';
import { Button } from '@/ui/primitives/Button';
import { SectionHeader } from '@/ui/primitives/Text';
import { useToast } from '@/ui/primitives/Toast';
import shared from '../shared/shared.module.css';
import styles from './session.module.css';

/** Developer-only training export (see docs/model-training.md). Not shown to reps. */
export function TrainingExport() {
  const services = useServices();
  const toast = useToast();
  const { data: exportable = [] } = useExportableVisits(true);
  const [selected, setSelected] = useState('');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const busy = progress !== null;
  useHoldUpdates(busy);
  const visitId = selected || exportable[0]?.visit.id || '';

  const run = async (scope: { kind: 'visit'; visitId: string } | { kind: 'all' }) => {
    setProgress({ done: 0, total: 0 });
    try {
      // The zip library loads only when someone actually exports.
      const [{ exportTrainingPackage }, { browserReencode, createImageSanitizer }] =
        await Promise.all([
          import('@/services/training/exportPackage'),
          import('@/services/training/sanitize'),
        ]);
      const out = await exportTrainingPackage(
        {
          repos: services.repos,
          blobs: services.blobs,
          catalogue: services.catalogue,
          sanitize: createImageSanitizer(browserReencode),
          app: { version: BUILD.version, commit: BUILD.commit },
        },
        scope,
        (done, total) => setProgress({ done, total }),
      );
      downloadBlob(out.blob, out.fileName);
      toast(t.reps.exportDone(out.manifest.counts.images));
    } catch {
      toast(t.reps.exportFailed, 'danger');
    } finally {
      setProgress(null);
    }
  };

  return (
    <section className={styles.devTools} data-testid="training-export">
      <SectionHeader title={`${t.reps.devTools} · ${t.reps.exportTitle}`} />
      <p className={shared.muted}>{t.reps.exportHint}</p>
      {exportable.length === 0 ? (
        <p className={shared.muted}>{t.reps.exportNone}</p>
      ) : (
        <>
          <label className={styles.selectLabel}>
            <span>{t.reps.exportVisitLabel}</span>
            <select
              className={styles.select}
              value={visitId}
              onChange={(e) => setSelected(e.target.value)}
              disabled={busy}
            >
              {exportable.map(({ visit, store }) => {
                const at = visit.completedAt ?? visit.createdAt;
                return (
                  <option key={visit.id} value={visit.id}>
                    {store?.name ?? visit.storeId} · {formatLongDay(at)} {formatTime(at)}
                  </option>
                );
              })}
            </select>
          </label>
          <div className={styles.exportActions}>
            <Button
              variant="secondary"
              size="sm"
              disabled={busy || !visitId}
              onClick={() => void run({ kind: 'visit', visitId })}
            >
              {t.reps.exportVisit}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => void run({ kind: 'all' })}
            >
              {t.reps.exportAll(exportable.length)}
            </Button>
          </div>
        </>
      )}
      {progress && progress.total > 0 && (
        <p className={shared.muted} role="status">
          {t.reps.exporting(progress.done, progress.total)}
        </p>
      )}
    </section>
  );
}
