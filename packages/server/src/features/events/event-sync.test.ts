import { describe, expect, test } from 'bun:test';
import { calendarIn, eventIn } from '../../testing/records';
import type { CalendarEvent } from '../../model/event';
import type { SyncState } from '../../model/sync';
import { delta } from './event-sync';

const calendar = calendarIn('UTC');
const single = (id: string, etag = `"${id}"`): CalendarEvent => ({
  ...eventIn(calendar, {
    id,
    start: { dateTime: '2026-10-19T10:00:00Z' },
    end: { dateTime: '2026-10-19T11:00:00Z' },
  }),
  calendarId: calendar.id,
  etag,
});
const series = (recurrence: string[], etag: string): CalendarEvent => ({
  ...eventIn(calendar, {
    id: 'series',
    start: { dateTime: '2026-10-19T09:00:00Z', timeZone: 'UTC' },
    end: { dateTime: '2026-10-19T10:00:00Z', timeZone: 'UTC' },
    recurrence,
  }),
  calendarId: calendar.id,
  etag,
});
const state = (
  events: CalendarEvent[],
  singleEvents: boolean,
  window: Partial<SyncState> = {},
): SyncState => ({
  calendarId: calendar.id,
  userId: 'owner',
  singleEvents,
  timeZone: 'UTC',
  events,
  expires: Infinity,
  ...window,
});

describe('delta', () => {
  test('returns only events whose etag changed or that are new', () => {
    const before = [single('same'), single('edited')];
    const after = [single('same'), single('edited', '"v2"'), single('new')];
    expect(
      delta(state(before, false), after, calendar).map((e) => e.id),
    ).toEqual(['edited', 'new']);
  });

  test('reports trimmed occurrences as cancelled when expanding', () => {
    const before = series(['RRULE:FREQ=DAILY;COUNT=3'], '"v1"');
    const after = series(['RRULE:FREQ=DAILY;COUNT=1'], '"v2"');
    const result = delta(state([before], true), [after], calendar);
    expect(
      result
        .filter((e) => e.status === 'cancelled')
        .map((e) => e.id)
        .sort(),
    ).toEqual(['series_20261020T090000Z', 'series_20261021T090000Z']);
  });

  test('reports changed single events outside the initial window', () => {
    const window = {
      min: Date.parse('2026-01-01T00:00:00Z'),
      max: Date.parse('2026-01-02T00:00:00Z'),
    };
    const result = delta(
      state([single('late')], true, window),
      [single('late', '"v2"')],
      calendar,
    );
    expect(result.map((e) => e.id)).toEqual(['late']);
  });
});
