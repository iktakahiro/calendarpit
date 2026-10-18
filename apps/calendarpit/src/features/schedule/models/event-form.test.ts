import { describe, expect, test } from 'bun:test';
import type { Calendar, CalendarEvent } from '@calendarpit/server';
import {
  datePart,
  eventFormValues,
  timePart,
  toEventBody,
  toggleAllDay,
  validateEventForm,
  withDate,
  withTime,
  type EventFormValues,
} from './event-form';

const calendar: Calendar = {
  id: 'work',
  userId: 'alex',
  summary: 'Work',
  timeZone: 'Asia/Tokyo',
  primary: true,
};
const values = (overrides: Partial<EventFormValues> = {}): EventFormValues => ({
  ...eventFormValues(calendar, '2026-10-19'),
  ...overrides,
});

describe('eventFormValues', () => {
  test('defaults a new event to 10:00–11:00 on the date', () => {
    expect(values()).toMatchObject({
      allDay: false,
      start: '2026-10-19T10:00',
      end: '2026-10-19T11:00',
      transparency: 'opaque',
      extendedProperties: '{}',
    });
  });

  test('shows a timed event in the calendar zone', () => {
    const event = {
      start: { dateTime: '2026-10-19T01:00:00Z' },
      end: { dateTime: '2026-10-19T02:30:00Z' },
    } as CalendarEvent;
    expect(eventFormValues(calendar, '2026-10-19', event)).toMatchObject({
      start: '2026-10-19T10:00',
      end: '2026-10-19T11:30',
    });
  });
});

test.each([
  [true, { start: '2026-10-19', end: '2026-10-20' }],
  [false, { start: '2026-10-19T10:00', end: '2026-10-20T11:00' }],
])('toggleAllDay(%p)', (allDay, expected) => {
  expect(
    toggleAllDay({ start: '2026-10-19T09:15', end: '2026-10-20' }, allDay),
  ).toEqual(expected);
});

describe('date and time halves', () => {
  test.each([
    ['2026-10-19T09:15', '2026-10-19', '09:15'],
    ['2026-10-19', '2026-10-19', ''],
  ])('splits %p', (value, date, time) => {
    expect(datePart(value)).toBe(date);
    expect(timePart(value)).toBe(time);
  });

  test('a new date keeps the time, and a new time keeps the date', () => {
    expect(withDate('2026-10-19T09:15', '2026-11-02')).toBe('2026-11-02T09:15');
    expect(withTime('2026-10-19T09:15', '17:45')).toBe('2026-10-19T17:45');
  });

  test('an all-day value takes a date but gains no time', () => {
    expect(withDate('2026-10-19', '2026-11-02')).toBe('2026-11-02');
  });

  test('clearing the time keeps the date the picker chose', () => {
    expect(withTime('2026-10-19T09:15', '')).toBe('2026-10-19');
  });

  test('drops the seconds a time input may append', () => {
    expect(withTime('2026-10-19T09:15', '17:45:30')).toBe('2026-10-19T17:45');
  });
});

describe('validateEventForm', () => {
  test('accepts valid values', () => {
    expect(validateEventForm(values())).toBeUndefined();
  });

  test('accepts dates without times when the event is all-day', () => {
    expect(
      validateEventForm(
        values({ allDay: true, start: '2026-10-19', end: '2026-10-20' }),
      ),
    ).toBeUndefined();
  });

  test.each([
    [{ end: '2026-10-19T10:00' }, 'end', 'End must be after start.'],
    [{ end: '' }, 'end', 'Enter an end.'],
    [{ start: '2026-10-19' }, 'start', 'Enter a start time.'],
    [{ end: '2026-10-20' }, 'end', 'Enter an end time.'],
    [
      { extendedProperties: '[]' },
      'extendedProperties',
      'Extended properties must be a JSON object.',
    ],
    [
      { extendedProperties: '{' },
      'extendedProperties',
      'Extended properties must be a JSON object.',
    ],
  ])('rejects %p', (overrides, field, message) => {
    expect(validateEventForm(values(overrides))).toEqual({ [field]: message });
  });
});

test('toEventBody sends local times with the calendar zone, or dates', () => {
  expect(toEventBody(values(), calendar).start).toEqual({
    dateTime: '2026-10-19T10:00',
    timeZone: 'Asia/Tokyo',
  });
  expect(
    toEventBody(
      values({ allDay: true, start: '2026-10-19', end: '2026-10-20' }),
      calendar,
    ).end,
  ).toEqual({ date: '2026-10-20' });
});
