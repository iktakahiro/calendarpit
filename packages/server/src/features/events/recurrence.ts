import { Temporal } from '@js-temporal/polyfill';
import { RRule, RRuleSet } from 'rrule';
import { fail } from '../../shared/errors';
import { zone } from '../../shared/validation';
import type { Calendar } from '../../model/directory';
import type { CalendarEvent, EventTime } from '../../model/event';
import { interval, timeValue } from './event-time';

const day = 86400000;
/** Expansion never reaches further than about 100 years past DTSTART. */
const maxSpan = 366 * 100 * day;
/** Upper bound for COUNT, INTERVAL, and instances per expansion. */
const limit = 10000;
const compact = (value: string) =>
  value.replace(/[-:]/g, '').replace(/\.\d+/, '');
/**
 * Converts an instant to a "floating" Date whose UTC fields equal the local
 * wall-clock time in `tz`. rrule computes in wall-clock time this way.
 */
function wall(value: number, tz: string): Date {
  const local = Temporal.Instant.fromEpochMilliseconds(value)
    .toZonedDateTimeISO(tz)
    .toPlainDateTime();
  return new Date(`${local.toString()}Z`);
}
function localDate(value: string, allDay: boolean): Temporal.PlainDateTime {
  const match = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(
    value,
  );
  if (!match || allDay !== !match[4]) fail('Invalid recurrence date.');
  try {
    return Temporal.PlainDateTime.from(
      `${match[1]}-${match[2]}-${match[3]}T${match[4] ?? '00'}:${match[5] ?? '00'}:${match[6] ?? '00'}`,
      { overflow: 'reject' },
    );
  } catch {
    return fail('Invalid recurrence date.');
  }
}
/**
 * Builds the rrule set for a recurring event after validating every line.
 * Only the documented subset of RFC 5545 is accepted; anything else is
 * rejected rather than approximated.
 */
function schedule(event: CalendarEvent, calendar: Calendar): RRuleSet {
  const tz = event.start.timeZone ?? calendar.timeZone;
  if (!event.start.date && !event.start.timeZone)
    fail('Recurring timed events require start.timeZone.');
  const start = wall(timeValue(event.start, calendar.timeZone), tz);
  const set = new RRuleSet(true);
  const lines = event.recurrence ?? [];
  if (!lines.length || lines.length > 20)
    fail('Use between 1 and 20 recurrence lines.');
  for (const line of lines) {
    if (line.startsWith('RRULE:') || line.startsWith('EXRULE:')) {
      const ruleText = line.slice(line.indexOf(':') + 1);
      const parts = ruleText.split(';');
      if (parts.some((part) => !/^[A-Z]+=[^=;]+$/.test(part)))
        fail('Invalid recurrence rule part.');
      const allowed = [
        'FREQ',
        'INTERVAL',
        'COUNT',
        'UNTIL',
        'BYDAY',
        'BYMONTHDAY',
        'BYMONTH',
        'BYSETPOS',
        'WKST',
      ];
      const keys = parts.map((p) => p.split('=')[0]!);
      if (
        new Set(keys).size !== keys.length ||
        keys.some((key) => !allowed.includes(key))
      )
        fail(
          'Unsupported or duplicate recurrence rule part.',
          400,
          'unsupportedFeature',
        );
      const values: Record<string, string | undefined> = Object.fromEntries(
        parts.map((p) => p.split('=')),
      );
      if (!['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(values.FREQ ?? ''))
        fail(
          'Supported recurrence frequencies: DAILY, WEEKLY, MONTHLY, YEARLY.',
          400,
          'unsupportedFeature',
        );
      if (values.COUNT && values.UNTIL) fail('Use COUNT or UNTIL, not both.');
      for (const key of ['COUNT', 'INTERVAL'])
        if (
          values[key] &&
          (!/^\d+$/.test(values[key]!) ||
            Number(values[key]) < 1 ||
            Number(values[key]) > limit)
        )
          fail(`Recurrence ${key} must be between 1 and ${limit}.`);
      for (const [key, max] of [
        ['BYMONTH', 12],
        ['BYMONTHDAY', 31],
        ['BYSETPOS', 366],
      ] as const)
        if (
          values[key]
            ?.split(',')
            .some(
              (v) =>
                !/^-?\d+$/.test(v) ||
                Number(v) === 0 ||
                Math.abs(Number(v)) > max ||
                (key === 'BYMONTH' && Number(v) < 0),
            )
        )
          fail(`Invalid ${key}.`);
      if (
        values.BYDAY?.split(',').some(
          (v) => !/^([+-]?[1-5])?(MO|TU|WE|TH|FR|SA|SU)$/.test(v),
        )
      )
        fail('Invalid BYDAY.');
      if (
        values.BYDAY &&
        ['DAILY', 'WEEKLY'].includes(values.FREQ!) &&
        /[0-9]/.test(values.BYDAY)
      )
        fail('Ordinal BYDAY requires MONTHLY or YEARLY.');
      if (values.WKST && !/^(MO|TU|WE|TH|FR|SA|SU)$/.test(values.WKST))
        fail('Invalid WKST.');
      try {
        const options = RRule.parseString(ruleText);
        if (values.UNTIL) {
          const local = localDate(values.UNTIL, !!event.start.date);
          if (!event.start.date && !values.UNTIL.endsWith('Z'))
            fail('Timed recurrence UNTIL must be UTC.');
          options.until = event.start.date
            ? new Date(`${local.toString()}Z`)
            : wall(local.toZonedDateTime('UTC').epochMilliseconds, tz);
        }
        const rule = new RRule({ ...options, dtstart: start }, true);
        if (line.startsWith('EXRULE:')) set.exrule(rule);
        else set.rrule(rule);
      } catch (e) {
        if (e instanceof Error && 'status' in e) throw e;
        fail('Invalid recurrence rule.');
      }
    } else {
      const match = /^(RDATE|EXDATE)(?:;(VALUE=DATE|TZID=([^:]+)))?:(.+)$/.exec(
        line,
      );
      if (!match)
        fail('Unsupported recurrence line.', 400, 'unsupportedFeature');
      if (event.start.date && match[2] !== 'VALUE=DATE')
        fail('All-day recurrence dates require VALUE=DATE.');
      for (const value of match[4]!.split(',')) {
        const local = localDate(value, !!event.start.date);
        const sourceZone = value.endsWith('Z')
          ? 'UTC'
          : match[3]
            ? zone(match[3])
            : tz;
        const date = wall(
          local.toZonedDateTime(sourceZone).epochMilliseconds,
          tz,
        );
        if (match[1] === 'RDATE') set.rdate(date);
        else set.exdate(date);
      }
    }
  }
  return set;
}
/**
 * Validates a series' `recurrence` lines against the supported subset:
 * DAILY/WEEKLY/MONTHLY/YEARLY rules with COUNT, UNTIL, INTERVAL, BY* parts, and
 * WKST; EXRULE; and RDATE/EXDATE with VALUE=DATE or TZID.
 *
 * @throws {@link ApiError} 400, or 400 `unsupportedFeature` for valid iCalendar
 * that Calendarpit does not implement.
 */
export function validateRecurrence(event: CalendarEvent, calendar: Calendar) {
  schedule(event, calendar);
}
/**
 * Returns Google's instance ID for an occurrence: `<seriesId>_<start>`, where
 * the start is `YYYYMMDD` for all-day series and `YYYYMMDDTHHMMSSZ` otherwise.
 */
export function occurrenceId(
  event: CalendarEvent,
  original: EventTime,
  calendar: Calendar,
) {
  return `${event.id}_${original.date ? compact(original.date) : compact(new Date(timeValue(original, calendar.timeZone)).toISOString())}`;
}
/**
 * Materializes one occurrence of a series at a wall-clock start.
 *
 * @throws {@link ApiError} 400 `unsupportedFeature` when the occurrence falls
 * in a DST gap, because Google's shifting behavior is not reproduced.
 */
function instance(
  event: CalendarEvent,
  date: Date,
  calendar: Calendar,
): CalendarEvent {
  const tz = event.start.timeZone ?? calendar.timeZone;
  const local = Temporal.PlainDateTime.from(date.toISOString().slice(0, -1));
  let start: EventTime;
  let end: EventTime;
  if (event.start.date) {
    const days = Temporal.PlainDate.from(event.start.date).until(
      Temporal.PlainDate.from(event.end.date!),
    ).days;
    start = { date: local.toPlainDate().toString() };
    end = { date: local.toPlainDate().add({ days }).toString() };
  } else {
    const zoned = local.toZonedDateTime(tz);
    if (!zoned.toPlainDateTime().equals(local))
      fail(
        'An occurrence falls in a nonexistent local time; this DST-gap recurrence is unsupported.',
        400,
        'unsupportedFeature',
      );
    const [a, b] = interval(event, calendar);
    start = {
      dateTime: zoned.toString({ timeZoneName: 'never' }),
      timeZone: tz,
    };
    end = {
      dateTime: zoned
        .add({ milliseconds: b - a })
        .toString({ timeZoneName: 'never' }),
      timeZone: tz,
    };
  }
  const { recurrence: _recurrence, ...rest } = event;
  return {
    ...structuredClone(rest),
    id: occurrenceId(event, start, calendar),
    start,
    end,
    recurringEventId: event.id,
    originalStartTime: start,
  };
}
/**
 * Expands a series into its occurrences that intersect `[min, max)`.
 *
 * Exceptions stored as separate events are not applied; use
 * {@link expandEvents} for that.
 *
 * @param min - Epoch milliseconds, or `-Infinity`.
 * @param max - Epoch milliseconds, or `Infinity`. Unbounded expansion is
 * allowed only when every rule has COUNT or UNTIL.
 * @throws {@link ApiError} 400 `unsupportedFeature` when the expansion is
 * unbounded or exceeds the instance or time-span limits.
 */
export function instances(
  event: CalendarEvent,
  calendar: Calendar,
  min: number,
  max: number,
): CalendarEvent[] {
  const set = schedule(event, calendar);
  const [a, b] = interval(event, calendar);
  const tz = event.start.timeZone ?? calendar.timeZone;
  const lower = Number.isFinite(min)
    ? Math.max(a - day, min - (b - a) - day)
    : a - day;
  const unbounded = !Number.isFinite(max);
  if (unbounded) {
    if (set.rrules().some((r) => !r.origOptions.count && !r.origOptions.until))
      fail(
        'Unbounded recurrence expansion requires timeMax.',
        400,
        'unsupportedFeature',
      );
    // Enumerate finite sets with hard limits instead of silently clipping a long series.
    const all = set.all((date, i) => {
      if (i >= limit || date.getTime() - a > maxSpan)
        fail(
          'Finite recurrence exceeds the expansion limit; provide a narrower time range.',
          400,
          'unsupportedFeature',
        );
      return true;
    });
    return all
      .map((d) => instance(event, d, calendar))
      .filter((e) => interval(e, calendar)[1] > min);
  }
  if (max - a > maxSpan || lower - a > maxSpan)
    fail(
      'Recurrence expansion is limited to 100 years from DTSTART.',
      400,
      'unsupportedFeature',
    );
  if (max < lower) return [];
  const dates = set.between(
    wall(lower, tz),
    wall(max + day, tz),
    true,
    (_date, i) => {
      if (i >= limit)
        fail(
          'Recurrence expansion exceeds 10000 instances; narrow the time range.',
          400,
          'unsupportedFeature',
        );
      return true;
    },
  );
  return dates
    .map((d) => instance(event, d, calendar))
    .filter((e) => {
      const [start, end] = interval(e, calendar);
      return start < max && end > min;
    });
}
/**
 * Returns the calendar's events in `[min, max)` with series expanded into
 * occurrences, as Google does for `singleEvents=true`.
 *
 * A stored exception replaces its generated occurrence. A cancelled series
 * cancels its exceptions too. Moved exceptions appear even when their
 * original slot is outside the window.
 */
export function expandEvents(
  events: CalendarEvent[],
  calendar: Calendar,
  min: number,
  max: number,
): CalendarEvent[] {
  const rows = events.filter((e) => e.calendarId === calendar.id);
  const exceptions = new Map(
    rows.filter((e) => e.recurringEventId).map((e) => [e.id, e]),
  );
  const result: CalendarEvent[] = [];
  for (const event of rows) {
    if (event.recurringEventId) continue;
    if (!event.recurrence) {
      result.push(event);
      continue;
    }
    for (const occurrence of instances(event, calendar, min, max)) {
      const replacement = exceptions.get(occurrence.id);
      result.push(
        replacement
          ? {
              ...replacement,
              ...(event.status === 'cancelled' ? { status: 'cancelled' } : {}),
            }
          : occurrence,
      );
      exceptions.delete(occurrence.id);
    }
  }
  // Include moved exceptions whose original slot is outside the requested window.
  result.push(...exceptions.values());
  return result.filter((e) => {
    const [a, b] = interval(e, calendar);
    return a < max && b > min;
  });
}
/**
 * Finds the generated occurrence for an instance ID such as
 * `series_20261019T010000Z`, so clients can read or modify one occurrence
 * that has no stored exception yet.
 *
 * @returns The occurrence, or `undefined` when no series produces that ID.
 */
export function resolveInstance(
  events: CalendarEvent[],
  calendar: Calendar,
  eventId: string,
): CalendarEvent | undefined {
  for (const master of events.filter(
    (e) => e.calendarId === calendar.id && e.recurrence,
  )) {
    if (!eventId.startsWith(`${master.id}_`)) continue;
    const suffix = eventId.slice(master.id.length + 1);
    let point: number;
    try {
      const date = localDate(suffix, !!master.start.date);
      point = date.toZonedDateTime(
        master.start.date ? calendar.timeZone : 'UTC',
      ).epochMilliseconds;
    } catch {
      continue;
    }
    return instances(master, calendar, point - day, point + day).find(
      (e) => e.id === eventId,
    );
  }
  return undefined;
}
