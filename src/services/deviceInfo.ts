import type { DeviceInfo } from '@/domain/models';

/** Coarse platform/browser family from the user agent; deliberately no versions or models. */
export function deviceFamily(userAgent: string, maxTouchPoints = 0): DeviceInfo {
  const ua = userAgent.toLowerCase();
  // iPadOS reports a desktop Mac user agent; touch support gives it away.
  const ipad = ua.includes('macintosh') && maxTouchPoints > 1;
  const platform: DeviceInfo['platform'] =
    /iphone|ipad|ipod/.test(ua) || ipad
      ? 'ios'
      : ua.includes('android')
        ? 'android'
        : ua.includes('mac os x') || ua.includes('macintosh')
          ? 'macos'
          : ua.includes('windows')
            ? 'windows'
            : ua.includes('linux')
              ? 'linux'
              : 'other';
  const browser: DeviceInfo['browser'] = ua.includes('samsungbrowser')
    ? 'samsung'
    : /edg(e|a|ios)?\//.test(ua)
      ? 'edge'
      : /firefox|fxios/.test(ua)
        ? 'firefox'
        : /chrome|crios|chromium/.test(ua)
          ? 'chrome'
          : ua.includes('safari')
            ? 'safari'
            : 'other';
  const mobile = platform === 'ios' || platform === 'android' || ua.includes('mobile');
  return { platform, browser, mobile };
}

export function currentDevice(): DeviceInfo | null {
  if (typeof navigator === 'undefined') return null;
  return deviceFamily(navigator.userAgent, navigator.maxTouchPoints ?? 0);
}
