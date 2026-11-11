import { useSyncExternalStore } from 'react';

export const LANGUAGES = ['da', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = 'da';
const STORAGE_KEY = 'shelfwise.language';

/** Locale used for dates and words; money and decimals always use da-DK (Danish market). */
export const TEXT_LOCALE: Record<Language, string> = { da: 'da-DK', en: 'en-GB' };

function read(): Language {
  try {
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY);
    return LANGUAGES.includes(stored as Language) ? (stored as Language) : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

let current: Language = read();
const listeners = new Set<() => void>();

export function getLanguage(): Language {
  return current;
}

/** Persisted on the device (localStorage) so it applies before the first render. */
export function setLanguage(language: Language): void {
  if (language === current) return;
  current = language;
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, language);
  } catch {
    // Storage unavailable (private mode): the choice lasts for this session only.
  }
  if (typeof document !== 'undefined') document.documentElement.lang = language;
  listeners.forEach((listener) => listener());
}

export function subscribeLanguage(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useLanguage(): Language {
  return useSyncExternalStore(subscribeLanguage, getLanguage, getLanguage);
}
