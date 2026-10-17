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

/**
 * Returns form values for editing `event`, or a 10:00–11:00 event on `date`
 * for a new one.
 */
export function eventFormValues(
  calendar: Calendar,
  date: string,
  event?: CalendarEvent,
): EventFormValues {
  const local = (value: CalendarEvent['start'] | undefined, fallback: string) =>
    value?.date ??
    (value?.dateTime ? localTime(value.dateTime, calendar.timeZone) : fallback);
  return {
    summary: event?.summary ?? '',
    description: event?.description ?? '',
    location: event?.location ?? '',
    allDay: !!event?.start.date,
    start: local(event?.start, `${date}T10:00`),
    end: local(event?.end, `${date}T11:00`),
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
  if (!values.start) errors.start = 'Enter a start.';
  if (!values.end) errors.end = 'Enter an end.';
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
