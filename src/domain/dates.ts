/** Calendar helpers on YYYY-MM-DD keys (no time zone involved once a key exists). */

export const STORE_TIME_ZONE = 'Europe/Copenhagen';

/** Calendar date of an instant in a time zone, as YYYY-MM-DD. */
export function dateKeyIn(iso: string, timeZone: string = STORE_TIME_ZONE): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

function toUtc(key: string): Date {
  return new Date(`${key}T00:00:00Z`);
}

export function addDays(key: string, days: number): string {
  const d = toUtc(key);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(key: string): number {
  return (toUtc(key).getUTCDay() + 6) % 7;
}

/** Monday–Sunday keys of the week containing `key`. */
export function weekOf(key: string): string[] {
  const monday = addDays(key, -weekdayIndex(key));
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / 86_400_000);
}
