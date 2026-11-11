import type { GrayImage } from '../guide/alignment';
import type { FrameInput, FrameOutput, VisionResponse } from './protocol';

/** Live camera vision (drink detection + overlap alignment), used only as guidance. */
export interface VisionEngine {
  /** Loads the drink detector; rejects if it cannot run on this device. */
  loadDetector(): Promise<{ backend: string }>;
  /** Right-edge strip of the previous photo to align against (null clears it). */
  setReference(reference: GrayImage | null): void;
  process(input: FrameInput): Promise<FrameOutput>;
  dispose(): void;
}

/** Test seam: Playwright installs a deterministic stub here (see e2e/helpers.ts). */
declare global {
  interface Window {
    __SHELFWISE_VISION__?: () => VisionEngine;
  }
}

export function visionSupported(): boolean {
  return (
    typeof Worker !== 'undefined' &&
    typeof WebAssembly !== 'undefined' &&
    'createImageBitmap' in window
  );
}

export function createVisionEngine(): VisionEngine {
  if (window.__SHELFWISE_VISION__) return window.__SHELFWISE_VISION__();
  return createWorkerEngine();
}

const EMPTY: FrameOutput = { boxes: null, detectMs: null, alignment: null, alignMs: null };

function createWorkerEngine(): VisionEngine {
  const worker = new Worker(new URL('./vision.worker.ts', import.meta.url), { type: 'module' });
  const absolute = (path: string) =>
    new URL(`${import.meta.env.BASE_URL}${path}`, window.location.origin).href;
  let nextId = 0;
  const pending = new Map<number, (r: FrameOutput) => void>();
  let detectorLoad: {
    resolve: (r: { backend: string }) => void;
    reject: (e: Error) => void;
  } | null = null;

  worker.onmessage = (event: MessageEvent<VisionResponse>) => {
    const msg = event.data;
    if (msg.type === 'detector-ready') detectorLoad?.resolve({ backend: msg.backend });
    else if (msg.type === 'detector-error') detectorLoad?.reject(new Error(msg.message));
    else {
      const { type: _type, id, ...output } = msg;
      pending.get(id)?.(output);
      pending.delete(id);
    }
  };
  worker.onerror = (event) => {
    detectorLoad?.reject(new Error(event.message || 'Vision worker failed'));
    pending.forEach((resolve) => resolve(EMPTY));
    pending.clear();
  };

  return {
    loadDetector() {
      return new Promise((resolve, reject) => {
        detectorLoad = { resolve, reject };
        worker.postMessage({
          type: 'init-detector',
          wasmBase: absolute('mediapipe/wasm'),
          modelUrl: absolute('models/efficientdet_lite0_int8.tflite'),
        });
      });
    },
    setReference(reference) {
      worker.postMessage({ type: 'set-reference', reference });
    },
    process(input) {
      const id = ++nextId;
      const transfer: Transferable[] = [];
      if (input.detectFrame) transfer.push(input.detectFrame);
      return new Promise((resolve) => {
        pending.set(id, resolve);
        worker.postMessage({ type: 'frame', id, ...input }, transfer);
      });
    },
    dispose() {
      worker.terminate();
      pending.clear();
    },
  };
}
