import { da } from './da';
import { en, type Strings } from './en';
import { getLanguage, type Language } from './language';

/** All user-facing copy lives in `en.ts` and `da.ts` (same shape). */
export const dictionaries: Record<Language, Strings> = { da, en };

/**
 * Current-language strings. Read `t.*` during render (never at module load) so a language
 * switch takes effect when the app re-renders.
 */
export const t: Strings = new Proxy({} as Strings, {
  get: (_target, key) => dictionaries[getLanguage()][key as keyof Strings],
});

export type { Strings };
