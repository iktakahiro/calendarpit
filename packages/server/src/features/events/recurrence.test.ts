import { describe, expect, test } from 'bun:test';
import { apiError } from '../../testing/api-error';
import { calendarIn, eventIn } from '../../testing/records';
import type { CalendarEvent } from '../../model/event';
import {
  expandEvents,
  instances,
  occurrenceId,
  resolveInstance,
  validateRecurrence,
} from './recurrence';

const newYork = calendarIn('America/New_York');
const daily = (recurrence: string[], extra: Record<string, unknown> = {}) =>
  eventIn(newYork, {
    id: 'series',
    start: {
      dateTime: '2026-03-07T09:00:00-05:00',
      timeZone: 'America/New_York',
    },
    end: {
      dateTime: '2026-03-07T10:00:00-05:00',
      timeZone: 'America/New_York',
    },
    recurrence,
    ...extra,
  });
const starts = (events: CalendarEvent[]) => events.map((e) => e.start.dateTime);

describe('validateRecurrence', () => {
  test.each([
    ['RRULE:FREQ=HOURLY', 'unsupportedFeature'],
    ['RRULE:FREQ=DAILY;BYHOUR=9', 'unsupportedFeature'],
    ['RRULE:FREQ=DAILY;COUNT=2;UNTIL=20260310T000000Z', 'invalidParameter'],
    ['RRULE:FREQ=WEEKLY;BYDAY=1MO', 'invalidParameter'],
    ['RRULE:FREQ=DAILY;UNTIL=20260310T000000', 'invalidParameter'],
    ['RRULE:FREQ=DAILY;COUNT=0', 'invalidParameter'],
    ['RRULE:FREQ=MONTHLY;BYMONTHDAY=32', 'invalidParameter'],
    ['X-UNKNOWN:VALUE', 'unsupportedFeature'],
  ])('rejects %s as %s', (line, reason) => {
    const series = daily(['RRULE:FREQ=DAILY;COUNT=1']);
    series.recurrence = [line];
    expect(apiError(() => validateRecurrence(series, newYork)).reason).toBe(
      reason,
    );
  });

  test('requires a time zone on recurring timed events', () => {
    expect(() =>
      eventIn(newYork, {
        start: { dateTime: '2026-03-07T09:00:00-05:00' },
        end: { dateTime: '2026-03-07T10:00:00-05:00' },
        recurrence: ['RRULE:FREQ=DAILY;COUNT=2'],
      }),
    ).toThrow('Recurring timed events require start.timeZone.');
  });
});

describe('instances', () => {
  test('keeps the local wall-clock time across a DST change', () => {
    expect(
      starts(
        instances(
          daily(['RRULE:FREQ=DAILY;COUNT=3']),
          newYork,
          -Infinity,
          Infinity,
        ),
      ),
    ).toEqual([
      '2026-03-07T09:00:00-05:00',
      '2026-03-08T09:00:00-04:00',
      '2026-03-09T09:00:00-04:00',
    ]);
  });

  test('applies EXDATE and RDATE', () => {
    const series = daily([
      'RRULE:FREQ=DAILY;COUNT=3',
      'EXDATE;TZID=America/New_York:20260308T090000',
      'RDATE;TZID=America/New_York:20260320T090000',
    ]);
    expect(starts(instances(series, newYork, -Infinity, Infinity))).toEqual([
      '2026-03-07T09:00:00-05:00',
      '2026-03-09T09:00:00-04:00',
      '2026-03-20T09:00:00-04:00',
    ]);
  });

  test('includes only occurrences that intersect the exclusive window', () => {
    const series = daily(['RRULE:FREQ=DAILY']);
    expect(
      starts(
        instances(
          series,
          newYork,
          Date.parse('2026-03-08T13:30:00Z'),
          Date.parse('2026-03-09T13:00:00Z'),
        ),
      ),
    ).toEqual(['2026-03-08T09:00:00-04:00']);
  });

  test('refuses unbounded expansion of an infinite rule', () => {
    const error = apiError(() =>
      instances(daily(['RRULE:FREQ=DAILY']), newYork, -Infinity, Infinity),
    );
    expect(error.reason).toBe('unsupportedFeature');
    expect(error.message).toBe(
      'Unbounded recurrence expansion requires timeMax.',
    );
  });
});

describe('occurrenceId', () => {
  test.each([
    [{ date: '2026-03-07' }, 'series_20260307'],
    [{ dateTime: '2026-03-07T09:00:00-05:00' }, 'series_20260307T140000Z'],
  ])('formats %p as %s', (start, expected) => {
    expect(occurrenceId(daily([]), start, newYork)).toBe(expected);
  });
});

describe('expandEvents', () => {
  const series = daily(['RRULE:FREQ=DAILY;COUNT=3']);
  const exception = (overrides: Partial<CalendarEvent>): CalendarEvent => ({
    ...instances(series, newYork, -Infinity, Infinity)[1]!,
    ...overrides,
  });

  test('replaces an occurrence with its stored exception', () => {
    const moved = exception({ summary: 'Moved' });
    const result = expandEvents([series, moved], newYork, -Infinity, Infinity);
    expect(result.map((e) => e.summary)).toEqual(['', 'Moved', '']);
  });

  test('cancels exceptions of a cancelled series', () => {
    const cancelled = { ...series, status: 'cancelled' as const };
    const result = expandEvents(
      [cancelled, exception({ summary: 'Moved' })],
      newYork,
      -Infinity,
      Infinity,
    );
    expect(result.find((e) => e.summary === 'Moved')?.status).toBe('cancelled');
  });

  test('includes an exception moved outside its original slot', () => {
    const moved = exception({
      start: { dateTime: '2026-04-01T09:00:00-04:00' },
      end: { dateTime: '2026-04-01T10:00:00-04:00' },
    });
    const result = expandEvents(
      [series, moved],
      newYork,
      Date.parse('2026-03-31T00:00:00Z'),
      Date.parse('2026-04-02T00:00:00Z'),
    );
    expect(result.map((e) => e.id)).toEqual([moved.id]);
  });
});

describe('resolveInstance', () => {
  const series = {
    ...daily(['RRULE:FREQ=DAILY;COUNT=3']),
    calendarId: newYork.id,
  };

  test('finds a generated occurrence by ID', () => {
    expect(
      resolveInstance([series], newYork, 'series_20260308T130000Z')?.start,
    ).toEqual({
      dateTime: '2026-03-08T09:00:00-04:00',
      timeZone: 'America/New_York',
    });
  });

  test.each(['series_20260310T130000Z', 'series_garbage', 'other_20260308'])(
    'returns undefined for %s',
    (id) => {
      expect(resolveInstance([series], newYork, id)).toBeUndefined();
    },
  );
});
