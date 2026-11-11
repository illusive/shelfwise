import type { PackSize } from '@/domain/catalogue';

/**
 * English UI text with Danish market conventions: money and decimals use da-DK, dates and
 * times use English wording in the store's time zone. Swap the locales here for Danish UI.
 */
export const LOCALES = { text: 'en-GB', numbers: 'da-DK' } as const;
export const CURRENCY = 'DKK';
export const DEFAULT_TIME_ZONE = 'Europe/Copenhagen';

const dkk = new Intl.NumberFormat(LOCALES.numbers, { style: 'currency', currency: CURRENCY });
const decimal1 = new Intl.NumberFormat(LOCALES.numbers, { maximumFractionDigits: 1 });

export function formatDkk(ore: number): string {
  return dkk.format(ore / 100);
}

export function formatNumber(value: number): string {
  return decimal1.format(value);
}

/** Shares are shown as whole percentages, as in the design. */
export function formatPct(pct: number): string {
  return `${Math.round(pct)}%`;
}

export function formatPp(delta: number): string {
  const arrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '→';
  return `${arrow} ${formatNumber(Math.abs(delta))} pp`;
}

function parts(iso: string, timeZone: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(LOCALES.text, { timeZone, ...options }).format(new Date(iso));
}

export function formatTime(iso: string, timeZone = DEFAULT_TIME_ZONE): string {
  return parts(iso, timeZone, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
}

/** e.g. "Tuesday, 10 Nov" */
export function formatLongDay(iso: string, timeZone = DEFAULT_TIME_ZONE): string {
  return parts(iso, timeZone, { weekday: 'long', day: 'numeric', month: 'short' });
}

/** Calendar date in the store's time zone, as YYYY-MM-DD. */
export function localDateKey(iso: string, timeZone = DEFAULT_TIME_ZONE): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

/** "Today", "Yesterday", "7 Nov" or "7 Nov 2025", by the store's local date. */
export function formatRelativeDay(
  iso: string,
  timeZone = DEFAULT_TIME_ZONE,
  now = new Date(),
): string {
  const day = localDateKey(iso, timeZone);
  const today = localDateKey(now.toISOString(), timeZone);
  const yesterday = localDateKey(new Date(now.getTime() - 86_400_000).toISOString(), timeZone);
  if (day === today) return 'Today';
  if (day === yesterday) return 'Yesterday';
  const sameYear = day.slice(0, 4) === today.slice(0, 4);
  return parts(
    iso,
    timeZone,
    sameYear
      ? { day: 'numeric', month: 'short' }
      : { day: 'numeric', month: 'short', year: 'numeric' },
  );
}

export function formatVolume(ml: number): string {
  return ml >= 1000 ? `${formatNumber(ml / 1000)} l` : `${ml} ml`;
}

const containerNames: Record<PackSize['container'], [string, string]> = {
  can: ['can', 'cans'],
  'glass-bottle': ['bottle', 'bottles'],
  'plastic-bottle': ['bottle', 'bottles'],
  carton: ['carton', 'cartons'],
};

/** "330 ml can", "6 × 330 ml cans" */
export function formatPack(
  pack: Pick<PackSize, 'units' | 'volumeMl'> & { container?: PackSize['container'] },
): string {
  const names = pack.container ? containerNames[pack.container] : null;
  if (pack.units === 1) return `${formatVolume(pack.volumeMl)}${names ? ` ${names[0]}` : ''}`;
  return `${pack.units} × ${formatVolume(pack.volumeMl)}${names ? ` ${names[1]}` : ''}`;
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function padSequence(n: number): string {
  return String(n).padStart(2, '0');
}

/** Parses "12,95", "12.95" or "12" kr. into øre; null when not a valid amount. */
export function parseDkkInput(value: string): number | null {
  const normalised = value
    .trim()
    .replace(/\s|kr\.?/gi, '')
    .replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalised)) return null;
  return Math.round(Number(normalised) * 100);
}
