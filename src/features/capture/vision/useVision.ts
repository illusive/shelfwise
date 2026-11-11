import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import {
  DEFAULT_GOVERNOR,
  InferenceGovernor,
  updateTracks,
  visibleTracks,
  type Track,
} from '../detection/tracking';
import type { GrayImage } from '../guide/alignment';
import { DEFAULT_GUIDE, lowPass, smoothOverlap } from '../guide/guide';
import { createVisionEngine, visionSupported, type VisionEngine } from './engine';
import { grabAlignFrame, grabDetectFrame } from './frames';

export type DetectionStatus = 'off' | 'loading' | 'running' | 'unavailable' | 'slow';
export type AlignmentStatus = 'off' | 'waiting' | 'running' | 'unavailable' | 'slow';

export interface LiveDetection {
  status: DetectionStatus;
  tracks: Track[];
  backend: string | null;
  averageMs: number | null;
}

export interface LiveAlignment {
  status: AlignmentStatus;
  /** Smoothed overlap with the previous photo, 0–1 of the view width. */
  overlap: number | null;
  /** Smoothed confidence, 0–1. */
  confidence: number;
  averageMs: number | null;
}

const DETECTION_OFF: LiveDetection = { status: 'off', tracks: [], backend: null, averageMs: null };
const ALIGNMENT_OFF: LiveAlignment = {
  status: 'off',
  overlap: null,
  confidence: 0,
  averageMs: null,
};
/** Alignment is cheap; above this average per frame the device is too slow for it. */
const ALIGN_SLOW_MS = 120;

export interface VisionOptions {
  detect: boolean;
  align: boolean;
  paused: boolean;
  /** Recent tilt change in degrees (null without sensors), used to damp the estimate. */
  tiltChange: () => number | null;
}

/**
 * One throttled frame pump for the camera's live guidance: grabs each frame once and sends
 * it to a single worker for drink detection and/or overlap alignment. Each task switches
 * itself off when it is too slow or fails; capture never depends on either.
 */
export function useVision(videoRef: RefObject<HTMLVideoElement | null>, options: VisionOptions) {
  const [detection, setDetection] = useState<LiveDetection>(DETECTION_OFF);
  const [alignment, setAlignment] = useState<LiveAlignment>(ALIGNMENT_OFF);
  const opts = useRef(options);
  opts.current = options;
  const engineRef = useRef<VisionEngine | null>(null);
  const referenceRef = useRef<GrayImage | null>(null);
  const smoothRef = useRef<{ overlap: number | null; confidence: number }>({
    overlap: null,
    confidence: 0,
  });
  const active = options.detect || options.align;

  const setReference = useCallback((reference: GrayImage | null) => {
    referenceRef.current = reference;
    smoothRef.current = { overlap: null, confidence: 0 };
    engineRef.current?.setReference(reference);
    setAlignment((s) =>
      s.status === 'off' || s.status === 'slow' || s.status === 'unavailable'
        ? s
        : { ...s, status: 'waiting', overlap: null, confidence: 0 },
    );
  }, []);

  useEffect(() => {
    if (!active) {
      setDetection(DETECTION_OFF);
      setAlignment(ALIGNMENT_OFF);
      return;
    }
    if (!visionSupported()) {
      setDetection((s) => ({ ...s, status: opts.current.detect ? 'unavailable' : 'off' }));
      setAlignment((s) => ({ ...s, status: opts.current.align ? 'unavailable' : 'off' }));
      return;
    }
    let engine: VisionEngine;
    try {
      engine = createVisionEngine();
    } catch {
      setDetection({ ...DETECTION_OFF, status: 'unavailable' });
      setAlignment({ ...ALIGNMENT_OFF, status: 'unavailable' });
      return;
    }
    engineRef.current = engine;
    if (referenceRef.current) engine.setReference(referenceRef.current);

    let cancelled = false;
    let frameRequest = 0;
    let detector: 'idle' | 'loading' | 'ready' | 'failed' | 'slow' = 'idle';
    let alignSlow = false;
    let shownDetect = false;
    let shownAlign = false;
    let tracks: Track[] = [];
    let trackId = 0;
    const pump = new InferenceGovernor({
      intervalMs: DEFAULT_GOVERNOR.intervalMs,
      slowMs: Infinity,
      window: 1,
    });
    const detectStats = new InferenceGovernor(DEFAULT_GOVERNOR);
    const alignStats = new InferenceGovernor({ intervalMs: 0, slowMs: ALIGN_SLOW_MS, window: 8 });
    const detectCanvas = document.createElement('canvas');
    const alignCanvas = document.createElement('canvas');

    const loadDetector = () => {
      detector = 'loading';
      setDetection((s) => ({ ...s, status: 'loading', tracks: [] }));
      engine
        .loadDetector()
        .then(({ backend }) => {
          if (cancelled) return;
          detector = 'ready';
          setDetection((s) => ({ ...s, status: opts.current.detect ? 'running' : 'off', backend }));
        })
        .catch(() => {
          if (cancelled) return;
          detector = 'failed';
          setDetection({ ...DETECTION_OFF, status: 'unavailable' });
        });
    };

    const tick = async () => {
      if (cancelled) return;
      frameRequest = requestAnimationFrame(() => void tick());
      const o = opts.current;

      // Reflect toggles without restarting the worker.
      if (o.detect && detector === 'idle') loadDetector();
      if (o.detect !== shownDetect) {
        shownDetect = o.detect;
        tracks = [];
        setDetection((s) =>
          !o.detect
            ? { ...DETECTION_OFF, backend: s.backend }
            : {
                ...s,
                tracks: [],
                status:
                  detector === 'ready'
                    ? 'running'
                    : detector === 'slow'
                      ? 'slow'
                      : detector === 'failed'
                        ? 'unavailable'
                        : 'loading',
              },
        );
      }
      if (o.align !== shownAlign) {
        shownAlign = o.align;
        setAlignment(
          !o.align
            ? ALIGNMENT_OFF
            : {
                ...ALIGNMENT_OFF,
                status: alignSlow ? 'slow' : referenceRef.current ? 'running' : 'waiting',
              },
        );
      }

      const video = videoRef.current;
      if (!video || video.readyState < 2 || video.videoWidth === 0) return;
      if (o.paused || document.hidden) {
        if (tracks.length) {
          tracks = [];
          setDetection((s) => ({ ...s, tracks: [] }));
        }
        return;
      }
      const now = performance.now();
      if (!pump.shouldRun(now)) return;
      const wantDetect = o.detect && detector === 'ready';
      const wantAlign = o.align && !alignSlow && referenceRef.current !== null;
      if (!wantDetect && !wantAlign) return;
      pump.start(now);
      try {
        const detectFrame = wantDetect ? await grabDetectFrame(video, detectCanvas) : null;
        const alignFrame = wantAlign ? grabAlignFrame(video, alignCanvas) : null;
        const out = await engine.process({ timestamp: now, detectFrame, alignFrame });
        pump.finish(0);
        if (cancelled) return;

        if (out.boxes && out.detectMs !== null && opts.current.detect) {
          detectStats.finish(out.detectMs);
          if (detectStats.tooSlow) {
            detector = 'slow';
            tracks = [];
            setDetection({ ...DETECTION_OFF, status: 'slow', averageMs: detectStats.averageMs });
          } else {
            tracks = updateTracks(tracks, out.boxes, () => ++trackId);
            setDetection((s) => ({
              ...s,
              status: 'running',
              tracks: visibleTracks(tracks),
              averageMs: detectStats.averageMs,
            }));
          }
        }

        if (out.alignment && out.alignMs !== null && opts.current.align && referenceRef.current) {
          alignStats.finish(out.alignMs);
          if (alignStats.tooSlow) {
            alignSlow = true;
            setAlignment({ ...ALIGNMENT_OFF, status: 'slow', averageMs: alignStats.averageMs });
          } else {
            const a = out.alignment;
            const s = smoothRef.current;
            const overlap = smoothOverlap(
              s.overlap,
              a.overlap,
              a.confidence,
              opts.current.tiltChange(),
            );
            const confidence = lowPass(s.confidence, a.confidence, 0.4);
            smoothRef.current = { overlap, confidence };
            setAlignment({
              status: 'running',
              overlap: confidence >= DEFAULT_GUIDE.minConfidence ? overlap : null,
              confidence,
              averageMs: alignStats.averageMs,
            });
          }
        }
      } catch {
        pump.finish(0);
      }
    };
    void tick();

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameRequest);
      engine.dispose();
      engineRef.current = null;
    };
  }, [active, videoRef]);

  return { detection, alignment, setReference };
}
