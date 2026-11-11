import { useEffect } from 'react';

/**
 * Applying an app update reloads the page. It waits while anything holds the gate (e.g. the
 * camera is open) and while the page is hidden, then runs as soon as it is safe.
 */
const holds = new Set<symbol>();
let pending: (() => void) | null = null;

function flush() {
  if (!pending || holds.size > 0) return;
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
  const apply = pending;
  pending = null;
  apply();
}

export function setPendingUpdate(apply: () => void) {
  pending = apply;
  flush();
}

export function holdUpdates(): () => void {
  const key = Symbol('update-hold');
  holds.add(key);
  return () => {
    holds.delete(key);
    flush();
  };
}

/** Holds app updates while the component is mounted (and `active`). */
export function useHoldUpdates(active = true) {
  useEffect(() => (active ? holdUpdates() : undefined), [active]);
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', flush);
}
