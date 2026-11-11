import type { Box } from '../detection/tracking';
import type { AlignResult, GrayImage } from '../guide/alignment';

export interface FrameInput {
  timestamp: number;
  /** Full video frame for drink detection (null = skip detection this tick). */
  detectFrame: ImageBitmap | null;
  /** Grayscale visible viewfinder for overlap alignment (null = skip alignment). */
  alignFrame: GrayImage | null;
}

export interface FrameOutput {
  boxes: Box[] | null;
  detectMs: number | null;
  alignment: AlignResult | null;
  alignMs: number | null;
}

export type VisionRequest =
  | { type: 'init-detector'; wasmBase: string; modelUrl: string }
  | { type: 'set-reference'; reference: GrayImage | null }
  | ({ type: 'frame'; id: number } & FrameInput);

export type VisionResponse =
  | { type: 'detector-ready'; backend: string }
  | { type: 'detector-error'; message: string }
  | ({ type: 'frame-result'; id: number } & FrameOutput);
