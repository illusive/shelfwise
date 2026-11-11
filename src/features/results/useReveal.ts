import { animate, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';

/**
 * 0 → 1 progress that replays whenever `key` changes (e.g. a new scope). Drives the share
 * count-up and the facing-grid fill together. Instant under reduced motion.
 */
export function useReveal(key: string, duration = 0.9): number {
  const reduced = useReducedMotion();
  const [progress, setProgress] = useState(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) {
      setProgress(1);
      return;
    }
    setProgress(0);
    const controls = animate(0, 1, {
      duration,
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate: setProgress,
    });
    return () => controls.stop();
  }, [key, reduced, duration]);
  return progress;
}
