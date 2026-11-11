import { registerSW } from 'virtual:pwa-register';
import { setPendingUpdate } from './updateGate';

const CHECK_INTERVAL_MS = 15 * 60_000;

/**
 * Registers the service worker and keeps the installed app current. Home-screen apps on iOS
 * resume from memory instead of reloading, so updates are checked whenever the app becomes
 * visible or focused (and every 15 min), and a new version is applied with a reload as soon as
 * no capture is in progress.
 */
export function startPwa() {
  if (!('serviceWorker' in navigator)) return;
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      setPendingUpdate(() => void updateSW(true));
    },
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      let last = 0;
      const check = () => {
        const now = Date.now();
        if (!navigator.onLine || now - last < 10_000) return;
        last = now;
        void registration.update().catch(() => undefined);
      };
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
      window.addEventListener('focus', check);
      window.addEventListener('pageshow', check);
      setInterval(check, CHECK_INTERVAL_MS);
    },
  });
}
