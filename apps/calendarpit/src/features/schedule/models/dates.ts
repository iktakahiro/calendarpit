import type { Locale } from '../../../lib/locale';
import { localTime } from './local-time';

/** Returns `date` (`YYYY-MM-DD`) moved by `days`, independent of time zones. */
export function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/**
 * Moves `date` (`YYYY-MM-DD`) forward (1) or backward (-1) by one period of
 * `view`, independent of time zones.
 */
export function shiftScheduleDate(
  date: string,
  view: 'day' | 'week',
  direction: -1 | 1,
) {
  return shiftDate(date, direction * (view === 'week' ? 7 : 1));
}

/**
 * Returns today's date in `timeZone`, or in the runtime's zone when no
 * calendar is selected.
 */
export function today(now: Date, timeZone?: string) {
  return timeZone
    ? localTime(now.toISOString(), timeZone).slice(0, 10)
    : now.toLocaleDateString('en-CA');
}

/** Formats a date as `Oct 19` in English or `10月19日` in Japanese. */
export function shortDate(date: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date.slice(0, 10)}T12:00:00Z`));
}

/**
 * Formats a date as `Monday, October 19, 2026` in English or
 * `2026年10月19日 月曜日` in Japanese.
 */
export function longDate(date: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));
}

/**
 * Returns `date` (`YYYY-MM-DD`) as a `Date` in the runtime's zone, at noon.
 * Date pickers compare calendar days in the runtime's zone, and noon keeps the
 * day stable across clock changes.
 */
export function toPickerDate(date: string) {
  return new Date(
    Number(date.slice(0, 4)),
    Number(date.slice(5, 7)) - 1,
    Number(date.slice(8, 10)),
    12,
  );
}

/** Formats a date picker's `Date` back as `YYYY-MM-DD` in the runtime's zone. */
export function fromPickerDate(value: Date) {
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

/** Formats a date's weekday as `Mon` in English or `月` in Japanese. */
export function weekdayLabel(date: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));
}
