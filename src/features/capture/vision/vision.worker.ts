/// <reference lib="webworker" />
import type { ObjectDetector } from '@mediapipe/tasks-vision';
import type { Box } from '../detection/tracking';
import { estimateOverlap, type GrayImage } from '../guide/alignment';
import type { VisionRequest, VisionResponse } from './protocol';

// One worker serves both live tasks from the same frames, off the main thread, so capture
// and UI never wait on them. MediaPipe loads only if drink detection is requested.
let detector: ObjectDetector | null = null;
let reference: GrayImage | null = null;
const post = (msg: VisionResponse) => (self as DedicatedWorkerGlobalScope).postMessage(msg);

async function initDetector(wasmBase: string, modelUrl: string) {
  try {
    const { FilesetResolver, ObjectDetector } = await import('@mediapipe/tasks-vision');
    const fileset = await FilesetResolver.forVisionTasks(wasmBase, true);
    // CPU (WASM SIMD): the GPU delegate silently returned no detections in testing.
    detector = await ObjectDetector.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: modelUrl, delegate: 'CPU' },
      runningMode: 'VIDEO',
      scoreThreshold: 0.3,
      maxResults: 50,
      // COCO classes that cover bottled and canned drinks; no brand or SKU recognition.
      categoryAllowlist: ['bottle', 'cup'],
    });
    post({ type: 'detector-ready', backend: 'CPU' });
  } catch (error) {
    post({
      type: 'detector-error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

function detect(frame: ImageBitmap, timestamp: number): { boxes: Box[]; ms: number } | null {
  if (!detector) return null;
  const start = performance.now();
  const result = detector.detectForVideo(frame, timestamp);
  const boxes = result.detections.flatMap((d) =>
    d.boundingBox
      ? [
          {
            x: d.boundingBox.originX / frame.width,
            y: d.boundingBox.originY / frame.height,
            width: d.boundingBox.width / frame.width,
            height: d.boundingBox.height / frame.height,
            score: d.categories[0]?.score ?? 0,
          },
        ]
      : [],
  );
  return { boxes, ms: performance.now() - start };
}

self.onmessage = (event: MessageEvent<VisionRequest>) => {
  const msg = event.data;
  if (msg.type === 'init-detector') {
    void initDetector(msg.wasmBase, msg.modelUrl);
    return;
  }
  if (msg.type === 'set-reference') {
    reference = msg.reference;
    return;
  }
  const out: VisionResponse = {
    type: 'frame-result',
    id: msg.id,
    boxes: null,
    detectMs: null,
    alignment: null,
    alignMs: null,
  };
  try {
    if (msg.detectFrame) {
      const d = detect(msg.detectFrame, msg.timestamp);
      if (d) {
        out.boxes = d.boxes;
        out.detectMs = d.ms;
      }
    }
    // A reference from another viewfinder size (e.g. after rotation) cannot be compared.
    if (msg.alignFrame && reference && reference.height === msg.alignFrame.height) {
      const start = performance.now();
      out.alignment = estimateOverlap(reference, msg.alignFrame);
      out.alignMs = performance.now() - start;
    }
  } finally {
    msg.detectFrame?.close();
    post(out);
  }
};
