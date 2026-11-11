import { useEffect, useRef } from 'react';
import { t } from '@/i18n/strings';
import { PlusIcon } from '@/ui/icons';
import type { LiveAlignment } from '../vision/useVision';
import { DEFAULT_GUIDE, guideStatus, type GuideStatus } from './guide';
import styles from './OverlapGuide.module.css';

/**
 * Translucent right-edge strip of the previous photo pinned to the left of the viewfinder,
 * the target zone at its edge, and a vertical marker showing where the previous photo now
 * ends in the live view (when the match is confident).
 */
export function OverlapGuide({
  strip,
  alignment,
  target,
  onNewSection,
}: {
  strip: HTMLCanvasElement;
  alignment: LiveAlignment;
  target: number;
  onNewSection: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    strip.className = styles.stripCanvas;
    el.replaceChildren(strip);
  }, [strip]);

  const config = { ...DEFAULT_GUIDE, target };
  const status: GuideStatus | 'paused' =
    alignment.status === 'running' || alignment.status === 'waiting'
      ? guideStatus(alignment.overlap, alignment.confidence, config)
      : 'paused';
  const showMarker = status !== 'searching' && status !== 'paused' && alignment.overlap !== null;

  return (
    <div
      className={styles.guide}
      data-testid="overlap-guide"
      data-status={status}
      data-overlap={alignment.overlap === null ? undefined : alignment.overlap.toFixed(2)}
      data-confidence={alignment.confidence.toFixed(2)}
      data-align-ms={alignment.averageMs === null ? undefined : Math.round(alignment.averageMs)}
      style={{
        ['--target' as string]: `${target * 100}%`,
        ['--tolerance' as string]: `${config.tolerance * 100}%`,
      }}
    >
      <div ref={host} className={styles.strip} aria-label={t.camera.guide.previous} role="img" />
      <span className={styles.band} aria-hidden="true" />
      {showMarker && (
        <span
          className={styles.marker}
          aria-hidden="true"
          style={{ left: `${Math.min(1, alignment.overlap!) * 100}%` }}
        >
          <span className={styles.handle} />
        </span>
      )}
      <button type="button" className={styles.newSection} onClick={onNewSection}>
        <PlusIcon size={14} />
        {t.camera.guide.newSection}
      </button>
    </div>
  );
}
