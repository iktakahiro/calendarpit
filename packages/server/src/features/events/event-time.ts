import { Temporal } from '@js-temporal/polyfill';
import { fail } from '../../shared/errors';
import { fields, instant, object, string, zone } from '../../shared/validation';
import type { Calendar } from '../../model/directory';
import type { CalendarEvent, EventTime } from '../../model/event';

const hasOffset = (value: string) => /[zZ]|[+-]\d{2}:\d{2}$/.test(value);

/**
 * Parses an event `start` or `end`.
 *
 * A local `dateTime` without an offset needs a `timeZone`; it is resolved and
 * stored with the offset. Times that fall in a DST gap or overlap are rejected
 * instead of guessed.
 *
 * @throws {@link ApiError} 400 for both or neither of `date` and `dateTime`, an
 * invalid date, a local time without a zone, or an ambiguous local time.
 */
export function eventTime(value: unknown): EventTime {
  const data = object(value);
  fields(data, ['date', 'dateTime', 'timeZone']);
  if (Boolean(data.date) === Boolean(data.dateTime))
    fail('Use exactly one of date and dateTime.');
  const tz = data.timeZone == null ? undefined : zone(data.timeZone);
  if (data.date) {
    const date = string(data.date, 'date');
    try {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw Error();
      Temporal.PlainDate.from(date, { overflow: 'reject' });
    } catch {
      fail('Invalid date.');
    }
    return { date, ...(tz ? { timeZone: tz } : {}) };
  }
  let dateTime = string(data.dateTime, 'dateTime');
  if (hasOffset(dateTime)) instant(dateTime);
  else {
    if (!tz) fail('dateTime requires an offset or timeZone.');
    try {
      dateTime = Temporal.PlainDateTime.from(dateTime)
        .toZonedDateTime(tz, {
          disambiguation: 'reject',
        })
        .toString({ timeZoneName: 'never' });
    } catch {
      fail('Invalid or ambiguous local time; supply an explicit offset.');
    }
  }
  return { dateTime, ...(tz ? { timeZone: tz } : {}) };
}

/**
 * Converts an event time to epoch milliseconds. An all-day `date` starts at
 * local midnight in the calendar's zone.
 */
export function timeValue(time: EventTime, calendarZone: string): number {
  if (time.date)
    return Temporal.PlainDate.from(time.date).toZonedDateTime(calendarZone)
      .epochMilliseconds;
  if (hasOffset(time.dateTime!)) return instant(time.dateTime);
  return Temporal.PlainDateTime.from(time.dateTime!).toZonedDateTime(
    time.timeZone!,
    { disambiguation: 'reject' },
  ).epochMilliseconds;
}

/**
 * Returns an event's `[start, end)` interval in epoch milliseconds. All-day
 * events use the calendar's zone, so a DST day lasts 23 or 25 hours.
 */
export function interval(
  event: CalendarEvent,
  calendar: Calendar,
): [number, number] {
  return [
    timeValue(event.start, calendar.timeZone),
    timeValue(event.end, calendar.timeZone),
  ];
}

/**
 * Whether an event's interval intersects `[min, max)`. Touching boundaries do
 * not overlap, matching Google's exclusive `timeMin` and `timeMax`.
 */
export function overlaps(
  event: CalendarEvent,
  calendar: Calendar,
  min: number,
  max: number,
) {
  const [a, b] = interval(event, calendar);
  return a < max && b > min;
}
