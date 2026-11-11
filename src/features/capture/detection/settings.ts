import { useCallback, useState } from 'react';

const KEY = 'shelfwise.liveDetection';

/** Live detection preference, persisted on the device. Default on. */
export function useLiveDetectionSetting(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(() => {
    try {
      return localStorage.getItem(KEY) !== 'off';
    } catch {
      return true;
    }
  });
  const set = useCallback((next: boolean) => {
    setOn(next);
    try {
      localStorage.setItem(KEY, next ? 'on' : 'off');
    } catch {
      // Private mode: preference lasts for this session.
    }
  }, []);
  return [on, set];
}
