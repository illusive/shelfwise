import type { FacingCounts } from '@/domain/sos';
import styles from './results.module.css';
import { scaleCounts } from './scaleCounts';

const MAX_CELLS = 84;

/**
 * Figma's facing grid: one cell per visible facing (scaled when there are many). `progress`
 * (0–1) colours cells in order for the reveal animation.
 */
export function FacingGrid({ counts, progress = 1 }: { counts: FacingCounts; progress?: number }) {
  const [client, competitor, unknown] = scaleCounts(
    [counts.client, counts.competitor, counts.unknown],
    MAX_CELLS,
  );
  const cells = [
    ...Array<'client'>(client).fill('client'),
    ...Array<'competitor'>(competitor).fill('competitor'),
    ...Array<'unknown'>(unknown).fill('unknown'),
  ];
  const revealed = Math.round(progress * cells.length);
  return (
    <div className={styles.grid} aria-hidden="true">
      {cells.map((kind, i) => (
        <span key={i} className={styles.cell} data-kind={i < revealed ? kind : 'pending'} />
      ))}
    </div>
  );
}
