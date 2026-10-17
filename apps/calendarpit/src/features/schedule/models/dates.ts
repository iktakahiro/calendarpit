import { localTime } from './local-time';

/** Returns `date` (`YYYY-MM-DD`) moved by `days`, independent of time zones. */
export function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
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

/** Formats a date as `Oct 19`. */
export function shortDate(date: string) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date.slice(0, 10)}T12:00:00Z`));
}

/** Formats a date as `Monday, October 19, 2026`. */
export function longDate(date: string) {
  return new Intl.DateTimeFormat('en', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));
}
