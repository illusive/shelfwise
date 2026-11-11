import { t } from '@/i18n/strings';
import type { LiveAlignment } from '../vision/useVision';
import { DEFAULT_GUIDE, guideStatus } from './guide';

/** Hint shown at the top of the viewfinder while a previous-photo strip is shown. */
export function guideHint(alignment: LiveAlignment, target: number): string {
  if (alignment.status === 'slow' || alignment.status === 'unavailable') return t.camera.guide.slow;
  const status = guideStatus(alignment.overlap, alignment.confidence, { ...DEFAULT_GUIDE, target });
  return {
    aligned: t.camera.guide.aligned,
    'move-right': t.camera.guide.moveRight,
    'move-left': t.camera.guide.moveLeft,
    searching: t.camera.guide.searching,
  }[status];
}
