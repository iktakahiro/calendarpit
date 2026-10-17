import { describe, expect, test } from 'bun:test';
import { calendarIn, eventIn } from '../../testing/records';
import type { CalendarEvent } from '../../model/event';
import {
  filterEvents,
  matchesOriginalStart,
  sortEvents,
  type EventListFilter,
} from './event-list';

const calendar = calendarIn('UTC');
const event = (
  id: string,
  overrides: Partial<CalendarEvent> = {},
): CalendarEvent => ({
  ...eventIn(calendar, {
    id,
    start: { dateTime: '2026-10-19T10:00:00Z' },
    end: { dateTime: '2026-10-19T11:00:00Z' },
  }),
  ...overrides,
});
const filter = (overrides: Partial<EventListFilter> = {}): EventListFilter => ({
  showDeleted: false,
  singleEvents: false,
  privateProperties: [],
  sharedProperties: [],
  ...overrides,
});
const ids = (rows: CalendarEvent[]) => rows.map((e) => e.id);

describe('filterEvents', () => {
  const live = event('live');
  const deleted = event('deleted', { status: 'cancelled' });
  const deletedException = event('series_1', {
    status: 'cancelled',
    recurringEventId: 'series',
    originalStartTime: { dateTime: '2026-10-19T10:00:00Z' },
  });
  const rows = [live, deleted, deletedException];

  test('hides cancelled events but keeps cancelled exceptions of a series', () => {
    expect(ids(filterEvents(rows, filter()))).toEqual(['live', 'series_1']);
  });

  test('hides cancelled exceptions when expanding single events', () => {
    expect(ids(filterEvents(rows, filter({ singleEvents: true })))).toEqual([
      'live',
    ]);
  });

  test.each([{ showDeleted: true }, { updatedMin: 0 }])(
    'shows cancelled events with %p',
    (overrides) => {
      expect(ids(filterEvents(rows, filter(overrides)))).toEqual([
        'live',
        'deleted',
        'series_1',
      ]);
    },
  );

  test('requires every extended property filter to match', () => {
    const tagged = event('tagged', {
      extendedProperties: { private: { a: '1', b: '2' }, shared: { c: '3' } },
    });
    const partial = event('partial', {
      extendedProperties: { private: { a: '1' } },
    });
    expect(
      ids(
        filterEvents(
          [tagged, partial],
          filter({
            privateProperties: ['a=1', 'b=2'],
            sharedProperties: ['c=3'],
          }),
        ),
      ),
    ).toEqual(['tagged']);
  });

  test.each(['novalue', '=value'])(
    'rejects the property filter %p',
    (value) => {
      expect(() =>
        filterEvents(rows, filter({ privateProperties: [value] })),
      ).toThrow('Invalid privateExtendedProperty; expected name=value.');
    },
  );

  test('matches a derived iCalUID', () => {
    expect(
      ids(filterEvents(rows, filter({ iCalUID: 'live@calendarpit.local' }))),
    ).toEqual(['live']);
  });
});

describe('sortEvents', () => {
  const early = event('b-early', {
    start: { dateTime: '2026-10-19T08:00:00Z' },
    updated: '2026-10-19T12:00:00.000Z',
  });
  const late = event('a-late', {
    start: { dateTime: '2026-10-19T09:00:00Z' },
    updated: '2026-10-19T11:00:00.000Z',
  });

  test.each([
    ['startTime', ['b-early', 'a-late']],
    ['updated', ['a-late', 'b-early']],
    [null, ['a-late', 'b-early']],
  ])('orders by %p', (orderBy, expected) => {
    expect(ids(sortEvents([early, late], orderBy, calendar))).toEqual(expected);
  });
});

test('matchesOriginalStart compares dates exactly and times as instants', () => {
  const timed = event('x', {
    originalStartTime: { dateTime: '2026-10-19T19:00:00+09:00' },
  });
  expect(matchesOriginalStart(timed, '2026-10-19T10:00:00Z')).toBe(true);
  expect(matchesOriginalStart(timed, '2026-10-19T11:00:00Z')).toBe(false);
  const allDay = event('y', { originalStartTime: { date: '2026-10-19' } });
  expect(matchesOriginalStart(allDay, '2026-10-19')).toBe(true);
});
