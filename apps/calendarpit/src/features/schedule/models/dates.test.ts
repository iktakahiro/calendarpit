import { expect, test } from 'bun:test';
import { longDate, shiftDate, shortDate, today } from './dates';

test.each([
  ['2026-10-19', 1, '2026-10-20'],
  ['2026-10-31', 1, '2026-11-01'],
  ['2026-03-01', -1, '2026-02-28'],
  ['2026-03-08', 1, '2026-03-09'],
])('shiftDate(%s, %i) is %s', (date, days, expected) => {
  expect(shiftDate(date, days)).toBe(expected);
});

test('today uses the calendar zone', () => {
  const now = new Date('2026-10-19T20:00:00Z');
  expect(today(now, 'Asia/Tokyo')).toBe('2026-10-20');
  expect(today(now, 'America/New_York')).toBe('2026-10-19');
});

test('formats dates independently of the runtime zone', () => {
  expect(shortDate('2026-10-19T23:30')).toBe('Oct 19');
  expect(longDate('2026-10-19')).toBe('Monday, October 19, 2026');
});
