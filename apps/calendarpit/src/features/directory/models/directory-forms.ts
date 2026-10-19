import type { Calendar, User } from '@calendarpit/server';
import type { Messages } from '../../../lib/messages';

/** The kinds of record the directory edits. */
export type DirectoryKind = 'user' | 'calendar';

/** Editable fields of a test user. */
export type UserFormValues = { name: string; email: string };

/** Editable fields of a calendar. */
export type CalendarFormValues = {
  summary: string;
  timeZone: string;
  primary: boolean;
};

/** Field errors keyed by field name. */
export type FieldErrors<T> = Partial<Record<keyof T, string>>;

/** Time zone suggested for new calendars. */
export const defaultTimeZone = 'Asia/Tokyo';

/** Returns form values for editing `user`, or empty values for a new user. */
export const userFormValues = (user?: User): UserFormValues => ({
  name: user?.name ?? '',
  email: user?.email ?? '',
});

/** Returns form values for editing `calendar`, or defaults for a new one. */
export const calendarFormValues = (
  calendar?: Calendar,
): CalendarFormValues => ({
  summary: calendar?.summary ?? '',
  timeZone: calendar?.timeZone ?? defaultTimeZone,
  primary: calendar?.primary ?? false,
});

/**
 * Checks a user form before it reaches the server, which validates again.
 * Errors are written in the language of `t`.
 *
 * @returns Field errors, or `undefined` when the values look valid.
 */
export function validateUserForm(
  values: UserFormValues,
  t: Messages,
): FieldErrors<UserFormValues> | undefined {
  const errors: FieldErrors<UserFormValues> = {};
  if (!values.name.trim()) errors.name = t['directory.user.errorName'];
  if (!/^[^\s@]+@[^\s@]+$/.test(values.email))
    errors.email = t['directory.user.errorEmail'];
  return Object.keys(errors).length ? errors : undefined;
}

/** Whether the runtime recognizes an IANA time zone name. */
export function isTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks a calendar form before it reaches the server, which validates again.
 * Errors are written in the language of `t`.
 *
 * @returns Field errors, or `undefined` when the values look valid.
 */
export function validateCalendarForm(
  values: CalendarFormValues,
  t: Messages,
): FieldErrors<CalendarFormValues> | undefined {
  const errors: FieldErrors<CalendarFormValues> = {};
  if (!values.summary.trim())
    errors.summary = t['directory.calendar.errorName'];
  if (!values.timeZone.trim() || !isTimeZone(values.timeZone))
    errors.timeZone = t['directory.calendar.errorTimeZone'];
  return Object.keys(errors).length ? errors : undefined;
}
