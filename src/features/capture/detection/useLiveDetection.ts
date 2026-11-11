import { useEffect, useRef, useState, type RefObject } from 'react';
import { createLiveDetector, detectionSupported, type LiveDetector } from './detector';
import { InferenceGovernor, updateTracks, visibleTracks, type Track } from './tracking';

export type DetectionStatus = 'off' | 'loading' | 'running' | 'unavailable' | 'slow';

const FRAME_WIDTH = 480; // inference input; the model itself works at 320 px

export interface LiveDetection {
  status: DetectionStatus;
  tracks: Track[];
  backend: string | null;
  averageMs: number | null;
}

/**
 * Optional live drink detection over the camera preview. Loads lazily once the camera is
 * ready, runs throttled in a worker, pauses when asked, and switches itself off if the
 * device is too slow or the model cannot load. Capture never depends on it.
 */
export function useLiveDetection(
  videoRef: RefObject<HTMLVideoElement | null>,
  { enabled, paused }: { enabled: boolean; paused: boolean },
): LiveDetection {
  const [state, setState] = useState<LiveDetection>({
    status: 'off',
    tracks: [],
    backend: null,
    averageMs: null,
  });
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    if (!enabled) {
      setState({ status: 'off', tracks: [], backend: null, averageMs: null });
      return;
    }
    if (!detectionSupported()) {
      setState((s) => ({ ...s, status: 'unavailable', tracks: [] }));
      return;
    }
    let cancelled = false;
    let frameRequest = 0;
    let detector: LiveDetector | null = null;
    let tracks: Track[] = [];
    let trackId = 0;
    const governor = new InferenceGovernor();
    const canvas = document.createElement('canvas');
    setState((s) => ({ ...s, status: 'loading', tracks: [] }));

    const tick = async () => {
      if (cancelled) return;
      frameRequest = requestAnimationFrame(() => void tick());
      const video = videoRef.current;
      const now = performance.now();
      if (!detector || !video || video.readyState < 2 || video.videoWidth === 0) return;
      if (pausedRef.current || document.hidden) {
        if (tracks.length) {
          tracks = [];
          setState((s) => ({ ...s, tracks: [] }));
        }
        return;
      }
      if (!governor.shouldRun(now)) return;
      governor.start(now);
      try {
        canvas.width = FRAME_WIDTH;
        canvas.height = Math.round((FRAME_WIDTH * video.videoHeight) / video.videoWidth);
        canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
        const frame = await createImageBitmap(canvas);
        const { boxes, ms } = await detector.detect(frame, now);
        governor.finish(ms);
        if (cancelled) return;
        if (governor.tooSlow) {
          cancelled = true;
          detector.dispose();
          setState({ status: 'slow', tracks: [], backend: null, averageMs: governor.averageMs });
          return;
        }
        tracks = updateTracks(tracks, boxes, () => ++trackId);
        setState((s) => ({
          ...s,
          status: 'running',
          tracks: visibleTracks(tracks),
          averageMs: governor.averageMs,
        }));
      } catch {
        governor.finish(Infinity);
      }
    };

    try {
      detector = createLiveDetector();
    } catch {
      setState((s) => ({ ...s, status: 'unavailable' }));
      return;
    }
    const current = detector;
    current
      .load()
      .then(({ backend }) => {
        if (cancelled) return;
        setState((s) => ({ ...s, status: 'running', backend }));
        void tick();
      })
      .catch(() => {
        if (cancelled) return;
        current.dispose();
        detector = null;
        setState({ status: 'unavailable', tracks: [], backend: null, averageMs: null });
      });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameRequest);
      detector?.dispose();
    };
  }, [enabled, videoRef]);

  return state;
}
