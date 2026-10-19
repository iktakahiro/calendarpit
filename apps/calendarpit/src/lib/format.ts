import type { Locale } from './locale';

/** Formats a timestamp in `locale` with a 24-hour clock. */
export const formatTimestamp = (value: string | number, locale: Locale) =>
  new Date(value).toLocaleString(locale, { hour12: false });

/** Formats the time of day of a timestamp in `locale` with a 24-hour clock. */
export const formatClock = (value: string | number | Date, locale: Locale) =>
  new Date(value).toLocaleTimeString(locale, { hour12: false });
