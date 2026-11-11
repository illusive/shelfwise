import { useCallback, useEffect, useRef, useState } from 'react';
import { OVERLAP_GUIDE_KEY, readToggle } from '../detection/settings';
import { lowPass, rollFromGravity } from './guide';

export type TiltStatus = 'waiting' | 'active' | 'needs-permission' | 'denied' | 'unavailable';

type PermissionFn = () => Promise<'granted' | 'denied'>;
const permissionFn = (): PermissionFn | undefined =>
  typeof DeviceMotionEvent !== 'undefined'
    ? (DeviceMotionEvent as unknown as { requestPermission?: PermissionFn }).requestPermission
    : undefined;

let permission: 'unknown' | 'granted' | 'denied' = 'unknown';
const listeners = new Set<() => void>();
const settle = (result: 'granted' | 'denied') => {
  permission = result;
  listeners.forEach((l) => l());
  return result;
};

/**
 * iOS only shows motion data after `DeviceMotionEvent.requestPermission()` is called from a
 * user gesture. Call this synchronously at the start of a tap that opens the camera.
 */
export function requestMotionPermission(): Promise<'granted' | 'denied' | 'unsupported'> {
  const request = permissionFn();
  if (!request) {
    if (typeof DeviceMotionEvent === 'undefined') return Promise.resolve('unsupported');
    permission = 'granted';
    return Promise.resolve('granted');
  }
  return request()
    .then(settle)
    .catch(() => settle('denied'));
}

/**
 * Asks for motion access on the first camera use, only where a prompt is needed (iOS) and the
 * overlap guide is on. Must run synchronously inside the tap that opens the camera.
 */
export function primeMotionPermission() {
  if (permission !== 'unknown' || !permissionFn()) return;
  if (!readToggle(OVERLAP_GUIDE_KEY)) return;
  void requestMotionPermission();
}

/** No motion events within this time means there is no usable sensor. */
const SENSOR_TIMEOUT_MS = 1500;

/** Smoothed phone roll (sideways tilt) for the level indicator and guide smoothing. */
export function useTilt(enabled: boolean) {
  const [status, setStatus] = useState<TiltStatus>('waiting');
  const [roll, setRoll] = useState<number | null>(null);
  const rollRef = useRef<number | null>(null);
  const lastRead = useRef<number | null>(null);
  const [attempt, setAttempt] = useState(0);

  // A permission answer that arrives after the camera opened restarts the sensor.
  useEffect(() => {
    const listener = () => setAttempt((n) => n + 1);
    listeners.add(listener);
    return () => void listeners.delete(listener);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    if (typeof DeviceMotionEvent === 'undefined') {
      setStatus('unavailable');
      return;
    }
    if (permissionFn() && permission !== 'granted') {
      setStatus(permission === 'denied' ? 'denied' : 'needs-permission');
      return;
    }
    setStatus('waiting');
    let gotEvent = false;
    let lastUpdate = 0;
    let trailing: ReturnType<typeof setTimeout> | undefined;
    const flush = () => {
      trailing = undefined;
      lastUpdate = performance.now();
      setRoll(rollRef.current);
    };
    const onMotion = (event: DeviceMotionEvent) => {
      const g = event.accelerationIncludingGravity;
      const next = g && g.x !== null && g.y !== null ? rollFromGravity(g.x, g.y) : null;
      if (next === null) return;
      if (!gotEvent) {
        gotEvent = true;
        setStatus('active');
      }
      rollRef.current = lowPass(rollRef.current, next, 0.25);
      // ~15 renders a second, always ending on the latest reading.
      const wait = 66 - (performance.now() - lastUpdate);
      if (wait <= 0) flush();
      else trailing ??= setTimeout(flush, wait);
    };
    window.addEventListener('devicemotion', onMotion);
    const timer = setTimeout(() => {
      if (!gotEvent) setStatus('unavailable');
    }, SENSOR_TIMEOUT_MS);
    return () => {
      window.removeEventListener('devicemotion', onMotion);
      clearTimeout(timer);
      clearTimeout(trailing);
    };
  }, [enabled, attempt]);

  /** Tilt change since the previous call (null without sensor data). */
  const readChange = useCallback(() => {
    const current = rollRef.current;
    if (current === null) return null;
    const change = lastRead.current === null ? 0 : Math.abs(current - lastRead.current);
    lastRead.current = current;
    return change;
  }, []);

  /** For the in-camera "Show level" button on iOS (a user gesture). */
  const request = useCallback(async () => {
    await requestMotionPermission();
  }, []);

  return { status, roll, readChange, request };
}
