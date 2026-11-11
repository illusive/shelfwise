import { useCallback, useEffect, useRef, useState } from 'react';

export type CameraStatus = 'starting' | 'ready' | 'denied' | 'unavailable' | 'insecure' | 'interrupted' | 'error';

const CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: {
    facingMode: { ideal: 'environment' },
    // Ask for the sharpest stream the device offers; price labels need the detail.
    width: { ideal: 3840 },
    height: { ideal: 2160 },
  },
};

type TorchCapabilities = MediaTrackCapabilities & { torch?: boolean };

/**
 * Keeps a rear-camera stream open for rapid repeated capture. Stops the stream when the page
 * is hidden (and restarts when visible) so the camera is never held in the background.
 */
export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const generation = useRef(0);
  const [status, setStatus] = useState<CameraStatus>('starting');
  const [torch, setTorch] = useState({ supported: false, on: false });

  const stop = useCallback(() => {
    generation.current += 1;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    stop();
    const mine = generation.current;
    if (!window.isSecureContext) return setStatus('insecure');
    if (!navigator.mediaDevices?.getUserMedia) return setStatus('unavailable');
    setStatus('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia(CONSTRAINTS);
      // A newer start/stop happened while waiting (e.g. StrictMode remount): release this one.
      if (mine !== generation.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => undefined);
      }
      const track = stream.getVideoTracks()[0];
      track?.addEventListener('ended', () => {
        if (mine === generation.current) setStatus('interrupted');
      });
      const capabilities = (track?.getCapabilities?.() ?? {}) as TorchCapabilities;
      setTorch({ supported: Boolean(capabilities.torch), on: false });
      setStatus('ready');
    } catch (error) {
      if (mine !== generation.current) return;
      const name = error instanceof DOMException ? error.name : '';
      if (name === 'NotAllowedError' || name === 'SecurityError') setStatus('denied');
      else if (name === 'NotFoundError' || name === 'OverconstrainedError') setStatus('unavailable');
      else setStatus('error');
    }
  }, [stop]);

  useEffect(() => {
    void start();
    const onVisibility = () => {
      if (document.hidden) {
        stop();
        setStatus('interrupted');
      } else {
        void start();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      stop();
    };
  }, [start, stop]);

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || !torch.supported) return;
    const on = !torch.on;
    try {
      await track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] });
      setTorch({ supported: true, on });
    } catch {
      setTorch({ supported: false, on: false });
    }
  }, [torch]);

  return { videoRef, status, torch, start, toggleTorch };
}
