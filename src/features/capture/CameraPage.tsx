import { useNavigate } from '@tanstack/react-router';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { useInvalidate, useVisitDetail } from '@/app/data';
import { useServices } from '@/app/services-context';
import type { Capture } from '@/domain/models';
import { padSequence } from '@/i18n/format';
import { t } from '@/i18n/strings';
import { captureVideoFrame } from '@/services/images';
import { CloseIcon, InfoIcon, LightningIcon, RefreshIcon, TrashIcon } from '@/ui/icons';
import { BlobImage } from '@/ui/primitives/BlobImage';
import { Button, IconButton } from '@/ui/primitives/Button';
import { Sheet } from '@/ui/primitives/Sheet';
import { useToast } from '@/ui/primitives/Toast';
import { useVisitActions } from '../visit/useVisitActions';
import { ImportPhotos } from './ImportPhotos';
import { useCamera, type CameraStatus } from './useCamera';
import styles from './CameraPage.module.css';

const BLOCKING: Partial<Record<CameraStatus, { title: string; hint: string }>> = {
  denied: { title: t.camera.denied, hint: t.camera.deniedHint },
  unavailable: { title: t.camera.unavailable, hint: t.camera.unavailableHint },
  insecure: { title: t.camera.insecure, hint: t.camera.insecureHint },
  interrupted: { title: t.camera.interrupted, hint: t.camera.interruptedHint },
  error: { title: t.camera.unavailable, hint: t.camera.unavailableHint },
};

export function CameraPage({ visitId, retakeCaptureId }: { visitId: string; retakeCaptureId?: string }) {
  const navigate = useNavigate();
  const services = useServices();
  const invalidate = useInvalidate();
  const toast = useToast();
  const actions = useVisitActions();
  const { data: detail } = useVisitDetail(visitId);
  const camera = useCamera();
  const [pending, setPending] = useState(0);
  const [flashKey, setFlashKey] = useState(0);
  const [retakeId, setRetakeId] = useState<string | null>(retakeCaptureId ?? null);
  const [stripOpen, setStripOpen] = useState(false);
  const [tipsOpen, setTipsOpen] = useState(false);

  const captures = detail?.captures ?? [];
  const count = captures.length + pending;
  const last = captures.at(-1);
  const retakeTarget = retakeId ? captures.find((c) => c.id === retakeId) : undefined;
  const blocking = BLOCKING[camera.status];
  const locked = detail && detail.visit.status !== 'draft';

  const close = () => {
    if (detail) void navigate({ to: '/stores/$storeId', params: { storeId: detail.store.id } });
    else void navigate({ to: '/' });
  };
  const done = () => void navigate({ to: '/visits/$visitId/captures', params: { visitId } });

  // Never awaits UI: the shutter is ready for the next tap immediately.
  const shoot = async () => {
    const video = camera.videoRef.current;
    if (!video || camera.status !== 'ready' || locked) return;
    setFlashKey((k) => k + 1);
    navigator.vibrate?.(8);
    const target = retakeId;
    if (!target) setPending((p) => p + 1);
    try {
      const blob = await captureVideoFrame(video);
      if (target) {
        setRetakeId(null);
        await services.captures.replaceCapture(target, { blob, source: 'camera' });
        await invalidate();
        if (retakeCaptureId) done();
      } else {
        await services.captures.addCapture(visitId, { blob, source: 'camera' });
        await invalidate();
      }
    } catch {
      toast(t.camera.saveFailed, 'danger');
    } finally {
      if (!target) setPending((p) => p - 1);
    }
  };

  const remove = async (capture: Capture) => {
    await actions.removeCapture(capture.id);
    if (retakeId === capture.id) setRetakeId(null);
  };

  return (
    <div className={styles.camera}>
      <video ref={camera.videoRef} className={styles.video} playsInline muted autoPlay aria-hidden="true" />
      <div className={styles.shadeTop} aria-hidden="true" />

      <header className={styles.top}>
        <IconButton label={t.common.close} onClick={close}>
          <CloseIcon />
        </IconButton>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>
            {retakeTarget ? t.camera.retakeTitle(padSequence(retakeTarget.sequence)) : t.camera.title}
          </h1>
          {detail && (
            <p className={styles.store} data-testid="camera-store">
              {detail.store.name} · {detail.store.address.street}
            </p>
          )}
        </div>
        <IconButton label={t.camera.tips} onClick={() => setTipsOpen(true)}>
          <InfoIcon />
        </IconButton>
        {camera.torch.supported && (
          <IconButton label={t.camera.torch} aria-pressed={camera.torch.on} onClick={() => void camera.toggleTorch()}>
            <LightningIcon />
          </IconButton>
        )}
      </header>

      {camera.status === 'ready' && (
        <>
          <p className={styles.tip}>{t.camera.tip[count === 0 ? 0 : 1]}</p>
          <div className={styles.frame} aria-hidden="true">
            <span className={styles.corner} data-pos="tl" />
            <span className={styles.corner} data-pos="tr" />
            <span className={styles.corner} data-pos="bl" />
            <span className={styles.corner} data-pos="br" />
          </div>
        </>
      )}

      {camera.status === 'starting' && <p className={styles.state}>{t.camera.starting}</p>}

      {blocking && (
        <div className={styles.blocking} role="alert">
          <p className={styles.blockingTitle}>{blocking.title}</p>
          <p className={styles.blockingHint}>{blocking.hint}</p>
          <div className={styles.blockingActions}>
            {(camera.status === 'interrupted' || camera.status === 'error' || camera.status === 'denied') && (
              <Button variant="accent" icon={<RefreshIcon size={18} />} onClick={() => void camera.start()}>
                {camera.status === 'interrupted' ? t.camera.resume : t.common.retry}
              </Button>
            )}
            <ImportPhotos
              variant="secondary"
              resolveVisitId={async () => visitId}
              onImport={async (id, files) => {
                await actions.importFiles(id, files);
              }}
            />
          </div>
        </div>
      )}

      <AnimatePresence>
        {flashKey > 0 && (
          <motion.div
            key={flashKey}
            className={styles.flash}
            initial={{ opacity: 0.85 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      <footer className={styles.controls}>
        <p className={styles.hint}>{t.camera.steady}</p>
        <p className={styles.mode}>{t.camera.mode.toUpperCase()}</p>
        <div className={styles.controlRow}>
          <button
            type="button"
            className={styles.lastThumb}
            onClick={() => setStripOpen(true)}
            disabled={captures.length === 0}
            aria-label={`${t.camera.captures}: ${count}`}
          >
            {last && <BlobImage blobId={last.thumbBlobId} fallbackBlobId={last.blobId} alt="" className={styles.lastImage} />}
            <AnimatePresence mode="popLayout">
              {count > 0 && (
                <motion.span
                  key={count}
                  className={styles.count}
                  data-testid="capture-count"
                  initial={{ scale: 0.4 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 600, damping: 22 }}
                >
                  {count}
                </motion.span>
              )}
            </AnimatePresence>
          </button>
          <button
            type="button"
            className={styles.shutter}
            aria-label={t.camera.shutter}
            disabled={camera.status !== 'ready' || Boolean(locked)}
            onClick={() => void shoot()}
          >
            <span className={styles.shutterInner} />
          </button>
          <Button variant="accent" onClick={done} disabled={pending > 0}>
            {t.camera.done}
          </Button>
        </div>
      </footer>

      <Sheet open={stripOpen} onOpenChange={setStripOpen} title={t.camera.captures} tone="dark">
        <ul className={styles.strip}>
          <AnimatePresence initial={false}>
            {captures.map((c) => (
              <motion.li
                key={c.id}
                layout
                className={styles.stripItem}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
              >
                <BlobImage blobId={c.thumbBlobId} fallbackBlobId={c.blobId} alt={t.store.capture(padSequence(c.sequence))} className={styles.stripImage} />
                <span className={styles.stripLabel}>{padSequence(c.sequence)}</span>
                <div className={styles.stripActions}>
                  <Button
                    variant="secondary"
                    icon={<RefreshIcon size={16} />}
                    onClick={() => {
                      setRetakeId(c.id);
                      setStripOpen(false);
                    }}
                  >
                    {t.camera.retake}
                  </Button>
                  <IconButton label={t.captures.remove(padSequence(c.sequence))} tone="dark" onClick={() => void remove(c)}>
                    <TrashIcon size={18} />
                  </IconButton>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </Sheet>

      <Sheet open={tipsOpen} onOpenChange={setTipsOpen} title={t.camera.tips}>
        <ul className={styles.tips}>
          {t.camera.tipsList.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      </Sheet>
    </div>
  );
}
