import type { FacingCounts } from '@/domain/sos';
import styles from './results.module.css';
import { scaleCounts } from './scaleCounts';

const MAX_CELLS = 84;

/** Figma's facing grid: one square per visible facing (scaled when there are many). */
export function FacingGrid({ counts }: { counts: FacingCounts }) {
  const [client, competitor, unknown] = scaleCounts([counts.client, counts.competitor, counts.unknown], MAX_CELLS);
  const cells = [
    ...Array<'client'>(client).fill('client'),
    ...Array<'competitor'>(competitor).fill('competitor'),
    ...Array<'unknown'>(unknown).fill('unknown'),
  ];
  return (
    <div className={styles.grid} aria-hidden="true">
      {cells.map((kind, i) => (
        <span key={i} className={styles.cell} data-kind={kind} />
      ))}
    </div>
  );
}
