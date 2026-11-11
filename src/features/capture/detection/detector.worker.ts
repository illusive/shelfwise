/// <reference lib="webworker" />
import { FilesetResolver, ObjectDetector } from '@mediapipe/tasks-vision';
import type { Box } from './tracking';
import type { WorkerRequest, WorkerResponse } from './protocol';

// Inference runs here, off the main thread, so capture and UI never wait on it.
let detector: ObjectDetector | null = null;
const post = (msg: WorkerResponse) => (self as DedicatedWorkerGlobalScope).postMessage(msg);

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;
  if (msg.type === 'init') {
    try {
      const fileset = await FilesetResolver.forVisionTasks(msg.wasmBase, true);
      // CPU (WASM SIMD): the GPU delegate silently returned no detections in testing.
      const create = (delegate: 'GPU' | 'CPU') =>
        ObjectDetector.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: msg.modelUrl, delegate },
          runningMode: 'VIDEO',
          scoreThreshold: 0.3,
          maxResults: 50,
          // COCO classes that cover bottled and canned drinks; no brand or SKU recognition.
          categoryAllowlist: ['bottle', 'cup'],
        });
      const delegate = 'CPU';
      detector = await create(delegate);
      post({ type: 'ready', delegate });
    } catch (error) {
      post({ type: 'error', message: error instanceof Error ? error.message : String(error) });
    }
    return;
  }
  if (msg.type === 'detect') {
    const { frame, timestamp, id } = msg;
    if (!detector) {
      frame.close();
      return;
    }
    const start = performance.now();
    try {
      const result = detector.detectForVideo(frame, timestamp);
      const boxes: Box[] = result.detections.flatMap((d) =>
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
      post({ type: 'result', id, boxes, ms: performance.now() - start });
    } catch (error) {
      post({ type: 'error', message: error instanceof Error ? error.message : String(error) });
    } finally {
      frame.close();
    }
  }
};
