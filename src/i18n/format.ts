import type { Address } from '@/domain/models';
import type { PackSize } from '@/domain/catalogue';
import { dateKeyIn } from '@/domain/dates';
import { getLanguage, TEXT_LOCALE } from './language';
import { t } from './strings';

/**
 * Danish market conventions: money and decimals always use da-DK; dates and words follow the
 * selected UI language, in the store's time zone.
 */
export const LOCALES = { numbers: 'da-DK' } as const;
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
  return new Intl.DateTimeFormat(TEXT_LOCALE[getLanguage()], { timeZone, ...options }).format(
    new Date(iso),
  );
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
  return dateKeyIn(iso, timeZone);
}

/** "Today"/"I dag", "Yesterday"/"I går", "7 Nov" or "7 Nov 2025", by the store's local date. */
export function formatRelativeDay(
  iso: string,
  timeZone = DEFAULT_TIME_ZONE,
  now = new Date(),
): string {
  const day = localDateKey(iso, timeZone);
  const today = localDateKey(now.toISOString(), timeZone);
  const yesterday = localDateKey(new Date(now.getTime() - 86_400_000).toISOString(), timeZone);
  if (day === today) return t.common.today;
  if (day === yesterday) return t.common.yesterday;
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

/** "330 ml can", "6 × 330 ml cans" */
export function formatPack(
  pack: Pick<PackSize, 'units' | 'volumeMl'> & { container?: PackSize['container'] },
): string {
  const names = pack.container ? t.packs[pack.container] : null;
  if (pack.units === 1) return `${formatVolume(pack.volumeMl)}${names ? ` ${names[0]}` : ''}`;
  return `${pack.units} × ${formatVolume(pack.volumeMl)}${names ? ` ${names[1]}` : ''}`;
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

/** Danish address order: "Vesterbrogade 12, 1. sal, 1620 København V" (floor only when set). */
export function formatAddress(address: Address): string {
  return [address.street, address.floor, `${address.postcode} ${address.city}`]
    .filter(Boolean)
    .join(', ');
}

/** Two-line Danish address: "Vesterbrogade 12, 1. sal" / "1620 København V". */
export function formatAddressLines(address: Address): [string, string] {
  return [
    [address.street, address.floor].filter(Boolean).join(', '),
    `${address.postcode} ${address.city}`,
  ];
}

function capitalise(text: string): string {
  return text.charAt(0).toLocaleUpperCase(TEXT_LOCALE[getLanguage()]) + text.slice(1);
}

/** Short weekday for a YYYY-MM-DD key, e.g. "Man" / "Mon". */
export function formatWeekdayShort(dateKey: string): string {
  const text = new Intl.DateTimeFormat(TEXT_LOCALE[getLanguage()], {
    weekday: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${dateKey}T12:00:00Z`));
  return capitalise(text.replace('.', ''));
}

/** Long weekday for a YYYY-MM-DD key, e.g. "torsdag" / "Thursday". */
export function formatWeekdayLong(dateKey: string): string {
  return new Intl.DateTimeFormat(TEXT_LOCALE[getLanguage()], {
    weekday: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${dateKey}T12:00:00Z`));
}
