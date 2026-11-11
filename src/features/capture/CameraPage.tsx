import { useNavigate } from '@tanstack/react-router';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { readConfig } from '@/app/config';
import { useInvalidate, useVisitDetail } from '@/app/data';
import { useServices } from '@/app/services-context';
import { useHoldUpdates } from '@/app/updateGate';
import type { Capture, CapturePlacement } from '@/domain/models';
import { padSequence, formatAddress } from '@/i18n/format';
import { t } from '@/i18n/strings';
import { captureVideoFrame } from '@/services/images';
import {
  CloseIcon,
  InfoIcon,
  LightningIcon,
  OverlapIcon,
  RefreshIcon,
  TrashIcon,
  ScanIcon,
} from '@/ui/icons';
import { BlobImage } from '@/ui/primitives/BlobImage';
import { Button, IconButton } from '@/ui/primitives/Button';
import { Sheet } from '@/ui/primitives/Sheet';
import { useToast } from '@/ui/primitives/Toast';
import { useVisitActions } from '../visit/useVisitActions';
import { ImportPhotos } from './ImportPhotos';
import { DetectionOverlay } from './detection/DetectionOverlay';
import { useLiveDetectionSetting, useOverlapGuideSetting } from './detection/settings';
import { DEFAULT_GUIDE, nextPlacement, RUN_GAP_MS, type RunState } from './guide/guide';
import { LevelIndicator } from './guide/LevelIndicator';
import { useTilt } from './guide/motion';
import { guideHint } from './guide/hints';
import { OverlapGuide } from './guide/OverlapGuide';
import { grabStrip, releaseCanvas, stripFromPhoto, type Strip } from './vision/frames';
import { useVision } from './vision/useVision';
import { Lightbox } from './Lightbox';
import { useCamera, type CameraStatus } from './useCamera';
import styles from './CameraPage.module.css';

const OVERLAP_TARGET = readConfig().overlapTarget;
const FAN_ANGLES = [[0], [-10, 8], [-16, -4, 11]];

const blockingFor = (): Partial<Record<CameraStatus, { title: string; hint: string }>> => ({
  denied: { title: t.camera.denied, hint: t.camera.deniedHint },
  unavailable: { title: t.camera.unavailable, hint: t.camera.unavailableHint },
  insecure: { title: t.camera.insecure, hint: t.camera.insecureHint },
  interrupted: { title: t.camera.interrupted, hint: t.camera.interruptedHint },
  error: { title: t.camera.unavailable, hint: t.camera.unavailableHint },
});

export function CameraPage({
  visitId,
  retakeCaptureId,
}: {
  visitId: string;
  retakeCaptureId?: string;
}) {
  const navigate = useNavigate();
  const services = useServices();
  const invalidate = useInvalidate();
  const toast = useToast();
  const actions = useVisitActions();
  const { data: detail } = useVisitDetail(visitId);
  const camera = useCamera();
  const [pending, setPending] = useState(0); // new photos being saved (shown in the count)
  const [saving, setSaving] = useState(0); // all shots being saved, including retakes
  const inflight = useRef(new Set<Promise<unknown>>());
  const [flashKey, setFlashKey] = useState(0);
  const [retakeId, setRetakeId] = useState<string | null>(retakeCaptureId ?? null);
  const [stripOpen, setStripOpen] = useState(false);
  const [tipsOpen, setTipsOpen] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);
  const [liveOn, setLiveOn] = useLiveDetectionSetting();
  const [guideOn, setGuideOn] = useOverlapGuideSetting();
  const ready = camera.status === 'ready';
  const tilt = useTilt(ready);
  // Load only once the camera runs; pause while sheets/lightbox cover the preview.
  const vision = useVision(camera.videoRef, {
    detect: liveOn && ready,
    align: guideOn && ready,
    paused: stripOpen || tipsOpen || viewId !== null,
    tiltChange: tilt.readChange,
  });
  const live = vision.detection;
  const target = OVERLAP_TARGET;
  // Right edge of the last photo in the current left-to-right run (guidance only).
  const [strip, setStrip] = useState<HTMLCanvasElement | null>(null);
  const stripRef = useRef<HTMLCanvasElement | null>(null);
  const shotRef = useRef(0);
  const runRef = useRef<RunState | null>(null);
  const newRunRef = useRef(false);
  const { setReference } = vision;
  // An app update never reloads the page while the camera is open.
  useHoldUpdates();
  const showStrip = useCallback(
    (next: Strip | null) => {
      if (stripRef.current !== next?.display) releaseCanvas(stripRef.current);
      stripRef.current = next?.display ?? null;
      setReference(next?.gray ?? null);
      setStrip(next?.display ?? null);
    },
    [setReference],
  );
  useEffect(() => () => releaseCanvas(stripRef.current), []);
  useEffect(() => {
    if (!strip) return;
    const timer = setTimeout(() => showStrip(null), RUN_GAP_MS);
    return () => clearTimeout(timer);
  }, [strip, showStrip]);
  useEffect(() => {
    if (!guideOn) showStrip(null);
  }, [guideOn, showStrip]);
  const newSection = () => {
    shotRef.current += 1;
    showStrip(null);
    newRunRef.current = true;
  };
  const [inView, setInView] = useState(0);
  const liveText =
    live.status === 'running'
      ? inView
        ? t.camera.live.count(inView)
        : t.camera.live.none
      : live.status === 'loading'
        ? t.camera.live.loading
        : live.status === 'slow'
          ? t.camera.live.slow
          : live.status === 'unavailable'
            ? t.camera.live.unavailable
            : null;

  const captures = detail?.captures ?? [];
  const count = captures.length + pending;
  // Up to the three newest photos, fanned out with the newest on top.
  const fan = captures.slice(-3);
  const retakeTarget = retakeId ? captures.find((c) => c.id === retakeId) : undefined;
  const blocking = blockingFor()[camera.status];
  const locked = detail && detail.visit.status !== 'draft';

  // Leaving the camera waits for photos still being saved, so none are lost or skipped.
  const settle = async () => {
    await Promise.allSettled([...inflight.current]);
    await services.captures.whenIdle(visitId);
  };
  const close = async () => {
    await settle();
    if (detail) await navigate({ to: '/stores/$storeId', params: { storeId: detail.store.id } });
    else await navigate({ to: '/' });
  };
  const done = async () => {
    await settle();
    await navigate({ to: '/visits/$visitId/captures', params: { visitId } });
  };

  // Never awaits UI: the shutter is ready for the next tap immediately.
  const shoot = () => {
    const run = save();
    inflight.current.add(run);
    void run.finally(() => inflight.current.delete(run));
  };

  const save = async () => {
    const video = camera.videoRef.current;
    if (!video || camera.status !== 'ready' || locked) return;
    setFlashKey((k) => k + 1);
    navigator.vibrate?.(8);
    const replaceId = retakeId;
    // Placement and the guide strip are taken synchronously, from the frame being captured.
    const shot = replaceId ? null : placeShot(video);
    const placement = shot?.placement ?? null;
    const view = { width: video.clientWidth, height: video.clientHeight };
    if (!replaceId) setPending((p) => p + 1);
    setSaving((n) => n + 1);
    try {
      const blob = await captureVideoFrame(video);
      // The live frame could not be read for the guide: build the strip from the photo.
      if (shot?.stripPending) {
        const id = shotRef.current;
        void stripFromPhoto(blob, view.width, view.height, target)
          .then((next) => {
            if (id === shotRef.current) showStrip(next);
            else releaseCanvas(next.display);
          })
          .catch(() => undefined);
      }
      if (replaceId) {
        setRetakeId(null);
        await services.captures.replaceCapture(replaceId, { blob, source: 'camera' });
        await invalidate();
        if (retakeCaptureId)
          await navigate({ to: '/visits/$visitId/captures', params: { visitId } });
      } else {
        await services.captures.addCapture(visitId, { blob, source: 'camera', placement });
        await invalidate();
      }
    } catch {
      toast(t.camera.saveFailed, 'danger');
    } finally {
      if (!replaceId) setPending((p) => p - 1);
      setSaving((n) => n - 1);
    }
  };

  const placeShot = (
    video: HTMLVideoElement,
  ): { placement: CapturePlacement; stripPending: boolean } => {
    const previousRun = Math.max(0, ...captures.map((c) => c.placement?.run ?? 0));
    const run = nextPlacement(runRef.current, Date.now(), previousRun, newRunRef.current);
    newRunRef.current = false;
    runRef.current = run;
    const a = vision.alignment;
    const measured =
      run.position > 1 &&
      strip !== null &&
      a.status === 'running' &&
      a.overlap !== null &&
      a.confidence >= DEFAULT_GUIDE.minConfidence;
    const round = (n: number) => Math.round(n * 1000) / 1000;
    let stripPending = false;
    if (guideOn) {
      shotRef.current += 1;
      try {
        showStrip(grabStrip(video, target));
      } catch {
        showStrip(null);
        stripPending = true;
      }
    }
    const placement: CapturePlacement = {
      run: run.run,
      position: run.position,
      overlap: measured ? round(Math.min(1, a.overlap!)) : null,
      confidence: measured ? round(a.confidence) : null,
      rollDeg:
        tilt.status === 'active' && tilt.roll !== null ? Math.round(tilt.roll * 10) / 10 : null,
    };
    return { placement, stripPending };
  };

  const remove = async (capture: Capture) => {
    await actions.removeCapture(capture.id);
    if (retakeId === capture.id) setRetakeId(null);
  };

  return (
    <div className={styles.camera}>
      <video
        ref={camera.videoRef}
        className={styles.video}
        playsInline
        muted
        autoPlay
        aria-hidden="true"
      />
      {live.status === 'running' && (
        <DetectionOverlay
          tracks={live.tracks}
          videoRef={camera.videoRef}
          onVisibleCount={setInView}
        />
      )}
      {guideOn && strip && ready && (
        <OverlapGuide
          strip={strip}
          alignment={vision.alignment}
          target={target}
          onNewSection={newSection}
        />
      )}
      <div className={styles.shadeTop} aria-hidden="true" />

      <header className={styles.top}>
        <IconButton label={t.common.close} tone="outline-light" onClick={() => void close()}>
          <CloseIcon />
        </IconButton>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>
            {retakeTarget
              ? t.camera.retakeTitle(padSequence(retakeTarget.sequence))
              : t.camera.title}
          </h1>
          {detail && (
            <p className={styles.store} data-testid="camera-store">
              {detail.store.name} · {formatAddress(detail.store.address)}
            </p>
          )}
        </div>
        <IconButton label={t.camera.tips} onClick={() => setTipsOpen(true)}>
          <InfoIcon />
        </IconButton>
        <IconButton
          label={t.camera.guide.toggle}
          aria-pressed={guideOn}
          className={guideOn ? styles.liveOn : undefined}
          onClick={() => setGuideOn(!guideOn)}
        >
          <OverlapIcon />
        </IconButton>
        <IconButton
          label={t.camera.live.toggle}
          aria-pressed={liveOn}
          className={liveOn ? styles.liveOn : undefined}
          onClick={() => setLiveOn(!liveOn)}
        >
          <ScanIcon />
        </IconButton>
        {camera.torch.supported && (
          <IconButton
            label={t.camera.torch}
            aria-pressed={camera.torch.on}
            onClick={() => void camera.toggleTorch()}
          >
            <LightningIcon />
          </IconButton>
        )}
      </header>

      {camera.status === 'ready' && (
        <>
          {guideOn && strip ? (
            <p
              className={styles.tip}
              data-testid="guide-hint"
              data-status={vision.alignment.status}
              aria-live="polite"
            >
              {guideHint(vision.alignment, target)}
            </p>
          ) : guideOn ? (
            <p className={styles.tip} data-testid="guide-first-hint">
              {t.camera.guide.first}
            </p>
          ) : (
            <p className={styles.tip}>{t.camera.tip[count === 0 ? 0 : 1]}</p>
          )}
          {guideOn && (
            <LevelIndicator
              status={tilt.status}
              roll={tilt.roll}
              onEnable={() => void tilt.request()}
            />
          )}
          {liveText && (
            <p
              className={styles.liveChip}
              data-testid="live-chip"
              data-status={live.status}
              data-backend={live.backend ?? undefined}
              data-avg-ms={live.averageMs === null ? undefined : Math.round(live.averageMs)}
              aria-live="polite"
            >
              <span className={styles.liveDot} aria-hidden="true" />
              {liveText}
            </p>
          )}
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
            {(camera.status === 'interrupted' ||
              camera.status === 'error' ||
              camera.status === 'denied') && (
              <Button
                variant="accent"
                icon={<RefreshIcon size={18} />}
                onClick={() => void camera.start()}
              >
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
            <AnimatePresence initial={false}>
              {fan.map((c, i) => (
                <motion.span
                  key={c.id}
                  className={styles.fanCard}
                  initial={{ opacity: 0, scale: 0.6, rotate: 0, y: -16 }}
                  animate={{ opacity: 1, scale: 1, rotate: FAN_ANGLES[fan.length - 1][i], y: 0 }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                  style={{ zIndex: i + 1 }}
                >
                  <BlobImage
                    blobId={c.thumbBlobId}
                    fallbackBlobId={c.blobId}
                    alt=""
                    className={styles.lastImage}
                  />
                </motion.span>
              ))}
            </AnimatePresence>
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
          </button>
          <button
            type="button"
            className={styles.shutter}
            aria-label={t.camera.shutter}
            disabled={camera.status !== 'ready' || Boolean(locked)}
            onClick={shoot}
          >
            <span className={styles.shutterInner} />
          </button>
          <Button variant="accent" onClick={() => void done()} disabled={saving > 0}>
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
                <button
                  type="button"
                  className={styles.stripOpen}
                  aria-label={t.captures.open(padSequence(c.sequence))}
                  onClick={() => {
                    setStripOpen(false);
                    setViewId(c.id);
                  }}
                >
                  <BlobImage
                    blobId={c.thumbBlobId}
                    fallbackBlobId={c.blobId}
                    alt=""
                    className={styles.stripImage}
                  />
                </button>
                <span className={styles.stripLabel}>{padSequence(c.sequence)}</span>
                <div className={styles.stripActions}>
                  <IconButton
                    label={t.camera.retake}
                    tone="outline-light"
                    onClick={() => {
                      setRetakeId(c.id);
                      setStripOpen(false);
                    }}
                  >
                    <RefreshIcon size={18} />
                  </IconButton>
                  <IconButton
                    label={t.captures.remove(padSequence(c.sequence))}
                    tone="outline-light"
                    onClick={() => void remove(c)}
                  >
                    <TrashIcon size={18} />
                  </IconButton>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </Sheet>

      <Lightbox
        captures={captures}
        openId={viewId}
        timeZone={detail?.store.timeZone ?? 'Europe/Copenhagen'}
        editable={!locked}
        onOpenChange={setViewId}
        onRetake={(c) => {
          setViewId(null);
          setRetakeId(c.id);
        }}
        onRemove={(c) => {
          setViewId(null);
          void remove(c);
        }}
      />

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
