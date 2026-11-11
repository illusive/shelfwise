import { useCallback, useState } from 'react';

export const LIVE_DETECTION_KEY = 'shelfwise.liveDetection';
export const OVERLAP_GUIDE_KEY = 'shelfwise.overlapGuide';

export function readToggle(key: string, defaultOn = true): boolean {
  try {
    const stored = localStorage.getItem(key);
    return stored === null ? defaultOn : stored === 'on';
  } catch {
    return defaultOn;
  }
}

/** On/off preference persisted on the device (localStorage). */
export function usePersistedToggle(
  key: string,
  defaultOn = true,
): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(() => readToggle(key, defaultOn));
  const set = useCallback(
    (next: boolean) => {
      setOn(next);
      try {
        localStorage.setItem(key, next ? 'on' : 'off');
      } catch {
        // Private mode: preference lasts for this session.
      }
    },
    [key],
  );
  return [on, set];
}

/** Live drink detection preference. Default on. */
export const useLiveDetectionSetting = () => usePersistedToggle(LIVE_DETECTION_KEY);

/** Overlap guide preference. Default on. */
export const useOverlapGuideSetting = () => usePersistedToggle(OVERLAP_GUIDE_KEY);
