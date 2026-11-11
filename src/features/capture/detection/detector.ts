import type { WorkerResponse } from './protocol';
import type { Box } from './tracking';

/** Generic on-device drink detector used only as live framing guidance. */
export interface LiveDetector {
  /** Resolves once the model is ready; rejects if it cannot run on this device. */
  load(): Promise<{ backend: string }>;
  /** Detections for one frame, normalised to the frame. */
  detect(frame: ImageBitmap, timestamp: number): Promise<{ boxes: Box[]; ms: number }>;
  dispose(): void;
}

/** Test seam: Playwright installs a deterministic stub here (see e2e/camera-detection.spec.ts). */
declare global {
  interface Window {
    __SHELFWISE_DETECTOR__?: () => LiveDetector;
  }
}

export function detectionSupported(): boolean {
  return (
    typeof Worker !== 'undefined' &&
    typeof WebAssembly !== 'undefined' &&
    'createImageBitmap' in window
  );
}

export function createLiveDetector(): LiveDetector {
  if (window.__SHELFWISE_DETECTOR__) return window.__SHELFWISE_DETECTOR__();
  return createWorkerDetector();
}

function createWorkerDetector(): LiveDetector {
  const worker = new Worker(new URL('./detector.worker.ts', import.meta.url), { type: 'module' });
  const base = import.meta.env.BASE_URL;
  const absolute = (path: string) => new URL(`${base}${path}`, window.location.origin).href;
  let nextId = 0;
  const pending = new Map<number, (r: { boxes: Box[]; ms: number }) => void>();
  let ready: ((r: { backend: string }) => void) | null = null;
  let fail: ((e: Error) => void) | null = null;

  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const msg = event.data;
    if (msg.type === 'ready') ready?.({ backend: msg.delegate });
    else if (msg.type === 'error') {
      fail?.(new Error(msg.message));
      pending.forEach((resolve) => resolve({ boxes: [], ms: Infinity }));
      pending.clear();
    } else if (msg.type === 'result') {
      pending.get(msg.id)?.({ boxes: msg.boxes, ms: msg.ms });
      pending.delete(msg.id);
    }
  };
  worker.onerror = (event) => fail?.(new Error(event.message || 'Detector worker failed'));

  return {
    load() {
      return new Promise((resolve, reject) => {
        ready = resolve;
        fail = reject;
        worker.postMessage({
          type: 'init',
          wasmBase: absolute('mediapipe/wasm'),
          modelUrl: absolute('models/efficientdet_lite0_int8.tflite'),
        });
      });
    },
    detect(frame, timestamp) {
      const id = ++nextId;
      return new Promise((resolve) => {
        pending.set(id, resolve);
        worker.postMessage({ type: 'detect', id, frame, timestamp }, [frame]);
      });
    },
    dispose() {
      worker.terminate();
      pending.clear();
    },
  };
}
