import type { Box } from './tracking';

export type WorkerRequest =
  | { type: 'init'; wasmBase: string; modelUrl: string }
  | { type: 'detect'; id: number; frame: ImageBitmap; timestamp: number };

export type WorkerResponse =
  | { type: 'ready'; delegate: 'GPU' | 'CPU' }
  | { type: 'result'; id: number; boxes: Box[]; ms: number }
  | { type: 'error'; message: string };
