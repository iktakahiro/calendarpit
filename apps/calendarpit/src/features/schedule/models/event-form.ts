import type { Calendar, CalendarEvent } from '@calendarpit/server';
import { shiftDate } from './dates';
import { localTime } from './local-time';

/** Values of the event editor form. Times are calendar-local. */
export type EventFormValues = {
  summary: string;
  description: string;
  location: string;
  allDay: boolean;
  /** `YYYY-MM-DD` when all-day, else `YYYY-MM-DDTHH:mm`. */
  start: string;
  /** Exclusive end, in the same format as `start`. */
  end: string;
  transparency: 'opaque' | 'transparent';
  /** `extendedProperties` as editable JSON text. */
  extendedProperties: string;
};

/** A timed form value, as the editor writes it. */
const timed = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** Returns the `YYYY-MM-DD` half of a form value. */
export function datePart(value: string) {
  return value.slice(0, 10);
}

/** Returns the `HH:mm` half of a form value, or `''` when it has no time. */
export function timePart(value: string) {
  return value.slice(11, 16);
}

/** Returns `value` moved to `date`, keeping the time half it already had. */
export function withDate(value: string, date: string) {
  const time = timePart(value);
  return time ? `${date}T${time}` : date;
}

/**
 * Returns `value` at `time` (`HH:mm`). An empty `time` keeps the date and
 * drops the time, so clearing the field reports a missing time rather than
 * losing the date the picker chose.
 */
export function withTime(value: string, time: string) {
  const date = datePart(value);
  return time ? `${date}T${time.slice(0, 5)}` : date;
}

/** Returns a local `YYYY-MM-DDTHH:mm` one hour later, rolling over midnight. */
function addHour(local: string) {
  const value = new Date(`${local}:00Z`);
  value.setUTCHours(value.getUTCHours() + 1);
  return value.toISOString().slice(0, 16);
}

/**
 * Returns form values for editing `event`, or for a new one: an hour from
 * `at`, or 10:00–11:00 on `date` when the editor was opened without a time.
 */
export function eventFormValues(
  calendar: Calendar,
  date: string,
  event?: CalendarEvent,
  at?: string,
): EventFormValues {
  const local = (value: CalendarEvent['start'] | undefined, fallback: string) =>
    value?.date ??
    (value?.dateTime ? localTime(value.dateTime, calendar.timeZone) : fallback);
  return {
    summary: event?.summary ?? '',
    description: event?.description ?? '',
    location: event?.location ?? '',
    allDay: !!event?.start.date,
    start: local(event?.start, at ?? `${date}T10:00`),
    end: local(event?.end, at ? addHour(at) : `${date}T11:00`),
    transparency: event?.transparency ?? 'opaque',
    extendedProperties: JSON.stringify(
      event?.extendedProperties ?? {},
      null,
      2,
    ),
  };
}

/**
 * Returns new `start` and `end` values after toggling all-day: one day from
 * the start date, or 10:00–11:00 on the existing dates.
 */
export function toggleAllDay(
  values: Pick<EventFormValues, 'start' | 'end'>,
  allDay: boolean,
) {
  const startDate = values.start.slice(0, 10);
  return allDay
    ? { start: startDate, end: shiftDate(startDate, 1) }
    : {
        start: `${startDate}T10:00`,
        end: `${values.end.slice(0, 10)}T11:00`,
      };
}

/** Parses the extended properties text, or returns `undefined` if invalid. */
function parseProperties(text: string): unknown {
  try {
    const value: unknown = JSON.parse(text);
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Checks the form before it reaches the server, which validates again.
 *
 * @returns Field errors, or `undefined` when the values look valid.
 */
export function validateEventForm(
  values: EventFormValues,
): Partial<Record<keyof EventFormValues, string>> | undefined {
  const errors: Partial<Record<keyof EventFormValues, string>> = {};
  const missingTime = (value: string) => !values.allDay && !timed.test(value);
  if (!values.start) errors.start = 'Enter a start.';
  else if (missingTime(values.start)) errors.start = 'Enter a start time.';
  if (!values.end) errors.end = 'Enter an end.';
  else if (missingTime(values.end)) errors.end = 'Enter an end time.';
  else if (values.start && values.end <= values.start)
    errors.end = 'End must be after start.';
  if (parseProperties(values.extendedProperties) === undefined)
    errors.extendedProperties = 'Extended properties must be a JSON object.';
  return Object.keys(errors).length ? errors : undefined;
}

/**
 * Builds the management API request body. Timed values are sent as local
 * times with the calendar's zone, which the server resolves and rejects when
 * they fall in a DST gap.
 */
export function toEventBody(values: EventFormValues, calendar: Calendar) {
  const time = (value: string) =>
    values.allDay
      ? { date: value.slice(0, 10) }
      : { dateTime: value, timeZone: calendar.timeZone };
  return {
    summary: values.summary,
    description: values.description,
    location: values.location,
    start: time(values.start),
    end: time(values.end),
    transparency: values.transparency,
    extendedProperties: parseProperties(values.extendedProperties),
  };
}
