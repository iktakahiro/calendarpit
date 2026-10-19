import { expect, test } from 'bun:test';
import {
  fromPickerDate,
  longDate,
  shiftDate,
  shortDate,
  today,
  toPickerDate,
  weekdayLabel,
} from './dates';

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
  expect(shortDate('2026-10-19T23:30', 'en')).toBe('Oct 19');
  expect(longDate('2026-10-19', 'en')).toBe('Monday, October 19, 2026');
  expect(weekdayLabel('2026-10-19', 'en')).toBe('Mon');
});

test('formats dates in Japanese', () => {
  expect(shortDate('2026-10-19T23:30', 'ja')).toBe('10月19日');
  // ICU versions differ on the space before the weekday.
  expect(longDate('2026-10-19', 'ja')).toMatch(/^2026年10月19日 ?月曜日$/);
  expect(weekdayLabel('2026-10-19', 'ja')).toBe('月');
});

test('round-trips picker dates in the runtime zone', () => {
  expect(fromPickerDate(toPickerDate('2026-10-19'))).toBe('2026-10-19');
  expect(fromPickerDate(toPickerDate('2026-03-08'))).toBe('2026-03-08');
  expect(fromPickerDate(new Date(2026, 0, 1, 12))).toBe('2026-01-01');
});
