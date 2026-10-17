import { describe, expect, test } from 'bun:test';
import { calendarIn, eventIn } from '../../testing/records';
import { eventTime, interval, overlaps, timeValue } from './event-time';

describe('eventTime', () => {
  test('keeps an offset dateTime and an all-day date as given', () => {
    expect(eventTime({ dateTime: '2026-10-19T10:00:00+09:00' })).toEqual({
      dateTime: '2026-10-19T10:00:00+09:00',
    });
    expect(eventTime({ date: '2026-10-19' })).toEqual({ date: '2026-10-19' });
  });

  test('resolves a local dateTime in its time zone', () => {
    expect(
      eventTime({ dateTime: '2026-10-19T10:00:00', timeZone: 'Asia/Tokyo' }),
    ).toEqual({
      dateTime: '2026-10-19T10:00:00+09:00',
      timeZone: 'Asia/Tokyo',
    });
  });

  test.each([
    [{}, 'Use exactly one of date and dateTime.'],
    [
      { date: '2026-10-19', dateTime: '2026-10-19T10:00:00Z' },
      'Use exactly one of date and dateTime.',
    ],
    [{ date: '2026-02-30' }, 'Invalid date.'],
    [{ date: '2026-1-5' }, 'Invalid date.'],
    [
      { dateTime: '2026-10-19T10:00:00' },
      'dateTime requires an offset or timeZone.',
    ],
    // Spring-forward gap in New York.
    [
      { dateTime: '2026-03-08T02:30:00', timeZone: 'America/New_York' },
      'Invalid or ambiguous local time; supply an explicit offset.',
    ],
    // Fall-back overlap in New York.
    [
      { dateTime: '2026-11-01T01:30:00', timeZone: 'America/New_York' },
      'Invalid or ambiguous local time; supply an explicit offset.',
    ],
  ])('rejects %p', (value, message) => {
    expect(() => eventTime(value)).toThrow(message);
  });
});

describe('timeValue and interval', () => {
  test('all-day dates start at midnight in the calendar zone', () => {
    expect(timeValue({ date: '2026-10-19' }, 'Asia/Tokyo')).toBe(
      Date.parse('2026-10-18T15:00:00Z'),
    );
  });

  test.each([
    ['2026-03-08', '2026-03-09', 23],
    ['2026-11-01', '2026-11-02', 25],
    ['2026-10-19', '2026-10-20', 24],
  ])(
    'an all-day event from %s to %s lasts %i hours in New York',
    (start, end, hours) => {
      const calendar = calendarIn('America/New_York');
      const [a, b] = interval(
        eventIn(calendar, { start: { date: start }, end: { date: end } }),
        calendar,
      );
      expect(b - a).toBe(hours * 3600000);
    },
  );
});

describe('overlaps', () => {
  const calendar = calendarIn('UTC');
  const event = eventIn(calendar, {
    start: { dateTime: '2026-10-19T10:00:00Z' },
    end: { dateTime: '2026-10-19T11:00:00Z' },
  });
  const at = (time: string) => Date.parse(`2026-10-19T${time}:00Z`);

  test.each([
    ['09:00', '10:00', false],
    ['11:00', '12:00', false],
    ['10:59', '12:00', true],
    ['09:00', '10:01', true],
    ['10:15', '10:30', true],
  ])('[%s, %s) overlaps: %p', (min, max, expected) => {
    expect(overlaps(event, calendar, at(min), at(max))).toBe(expected);
  });
});
