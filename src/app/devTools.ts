import { readConfig } from './config';

const KEY = 'shelfwise.devTools';

/** `?dev=1` turns developer tools on for this device, `?dev=0` turns them off. */
export function initDevTools(search = window.location.search) {
  const flag = new URLSearchParams(search).get('dev');
  try {
    if (flag === '1') localStorage.setItem(KEY, 'on');
    if (flag === '0') localStorage.removeItem(KEY);
  } catch {
    // Storage unavailable: dev tools follow the build flag only.
  }
}

/** Developer tools (training export) are hidden from reps unless enabled. */
export function devToolsEnabled(): boolean {
  if (readConfig().devTools) return true;
  try {
    return localStorage.getItem(KEY) === 'on';
  } catch {
    return false;
  }
}
