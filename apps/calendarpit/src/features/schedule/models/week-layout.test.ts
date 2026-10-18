import type { CalendarEvent } from '@calendarpit/server';
import { expect, test } from 'bun:test';
import { slotStart, weekDates, weekLayout, weekStart } from './week-layout';

const event = (id: string, start: string, end: string): CalendarEvent =>
  ({
    id,
    calendarId: 'work',
    status: 'confirmed',
    start: { dateTime: `${start}:00+09:00`, timeZone: 'Asia/Tokyo' },
    end: { dateTime: `${end}:00+09:00`, timeZone: 'Asia/Tokyo' },
  }) as CalendarEvent;

test.each([
  ['2026-10-19', '2026-10-18'],
  ['2026-10-18', '2026-10-18'],
  ['2026-10-24', '2026-10-18'],
  ['2026-10-25', '2026-10-25'],
])('weekStart(%s) is %s', (date, expected) => {
  expect(weekStart(date)).toBe(expected);
});

test('weekDates spans Sunday to Saturday', () => {
  const dates = weekDates('2026-10-21');
  expect(dates).toHaveLength(7);
  expect(dates[0]).toBe('2026-10-18');
  expect(dates[6]).toBe('2026-10-24');
});

test('weekStart honours a Monday-first week', () => {
  expect(weekStart('2026-10-18', 1)).toBe('2026-10-12');
  expect(weekStart('2026-10-19', 1)).toBe('2026-10-19');
});

test('weekLayout places each day on its own track', () => {
  const events = [
    event('a', '2026-10-19T10:00', '2026-10-19T11:00'),
    event('b', '2026-10-19T10:30', '2026-10-19T11:30'),
    event('c', '2026-10-20T23:00', '2026-10-21T01:00'),
  ];
  const days = weekLayout(
    events,
    'work',
    'Asia/Tokyo',
    weekDates('2026-10-19'),
  );
  const monday = days[1]!;
  expect(monday.date).toBe('2026-10-19');
  expect(monday.lanes).toBe(2);
  expect(monday.timed.map((p) => p.event.id)).toEqual(['a', 'b']);
  // The overnight event is clamped into both days it touches.
  expect(days[2]!.timed[0]).toMatchObject({
    startMinute: 1380,
    endMinute: 1440,
  });
  expect(days[3]!.timed[0]).toMatchObject({ startMinute: 0, endMinute: 60 });
});

test.each([
  [9, 0, '2026-10-19T09:00'],
  [9, 29, '2026-10-19T09:00'],
  [9, 30, '2026-10-19T09:30'],
  [23, 59, '2026-10-19T23:30'],
])('slotStart snaps %i:%i', (hour, minute, expected) => {
  expect(slotStart('2026-10-19', hour, minute)).toBe(expected);
});
