import { describe, expect, test } from 'bun:test';
import type { CalendarEvent } from '@calendarpit/server';
import {
  crossesClockChange,
  duration,
  eventsOn,
  minuteOf,
  placeEvents,
} from './day-layout';

const event = (
  id: string,
  start: CalendarEvent['start'],
  end: CalendarEvent['end'],
  overrides: Partial<CalendarEvent> = {},
): CalendarEvent => ({
  id,
  calendarId: 'work',
  kind: 'calendar#event',
  summary: id,
  start,
  end,
  transparency: 'opaque',
  status: 'confirmed',
  created: '',
  updated: '',
  etag: id,
  ...overrides,
});
const timed = (id: string, start: string, end: string) =>
  event(id, { dateTime: start }, { dateTime: end });

describe('eventsOn', () => {
  const rows = [
    timed('late', '2026-10-19T15:00:00Z', '2026-10-19T16:00:00Z'),
    timed('early', '2026-10-19T09:00:00Z', '2026-10-19T10:00:00Z'),
    timed('overnight', '2026-10-18T23:00:00Z', '2026-10-19T01:00:00Z'),
    timed('ends-at-midnight', '2026-10-18T22:00:00Z', '2026-10-19T00:00:00Z'),
    event('all-day', { date: '2026-10-19' }, { date: '2026-10-20' }),
    event('yesterday', { date: '2026-10-18' }, { date: '2026-10-19' }),
    timed('cancelled', '2026-10-19T09:00:00Z', '2026-10-19T10:00:00Z'),
    {
      ...timed('other', '2026-10-19T09:00:00Z', '2026-10-19T10:00:00Z'),
      calendarId: 'home',
    },
  ];
  rows[6]!.status = 'cancelled';

  test('keeps visible events overlapping the local day, sorted by start', () => {
    expect(
      eventsOn(rows, 'work', 'UTC', '2026-10-19').map((e) => e.id),
    ).toEqual(['overnight', 'all-day', 'early', 'late']);
  });

  test('uses the calendar time zone for timed events and exclusive all-day ends', () => {
    expect(
      eventsOn(rows, 'work', 'Asia/Tokyo', '2026-10-20').map((e) => e.id),
    ).toEqual(['late']);
  });
});

test.each([
  ['2026-10-18T23:00', 0],
  ['2026-10-19T01:30', 90],
  ['2026-10-20T00:00', 1440],
])('minuteOf(%s) on 2026-10-19 is %i', (local, minute) => {
  expect(minuteOf(local, '2026-10-19')).toBe(minute);
});

test('placeEvents puts overlapping events in separate lanes', () => {
  const placed = placeEvents(
    [
      timed('a', '2026-10-19T09:00:00Z', '2026-10-19T11:00:00Z'),
      timed('b', '2026-10-19T10:00:00Z', '2026-10-19T12:00:00Z'),
      timed('c', '2026-10-19T11:00:00Z', '2026-10-19T12:00:00Z'),
      event('all-day', { date: '2026-10-19' }, { date: '2026-10-20' }),
    ],
    'UTC',
    '2026-10-19',
  );
  expect(placed.map((p) => [p.event.id, p.lane])).toEqual([
    ['a', 0],
    ['b', 1],
    ['c', 0],
  ]);
});

test.each([
  [timed('x', '2026-10-19T09:00:00Z', '2026-10-19T10:30:00Z'), '1h 30m'],
  [timed('x', '2026-10-19T09:00:00Z', '2026-10-19T09:45:00Z'), '45m'],
  [timed('x', '2026-10-19T09:00:00Z', '2026-10-19T11:00:00Z'), '2h'],
  [event('x', { date: '2026-10-19' }, { date: '2026-10-20' }), '1 day'],
  [event('x', { date: '2026-10-19' }, { date: '2026-10-22' }), '3 days'],
])('duration of %#', (value, expected) => {
  expect(duration(value)).toBe(expected);
});

test('crossesClockChange detects mixed UTC offsets', () => {
  const spring = timed('dst', '2026-03-08T06:00:00Z', '2026-03-08T08:00:00Z');
  expect(crossesClockChange([spring], 'America/New_York')).toBe(true);
  expect(crossesClockChange([spring], 'UTC')).toBe(false);
});
