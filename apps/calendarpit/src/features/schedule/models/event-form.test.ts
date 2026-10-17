import { describe, expect, test } from 'bun:test';
import type { Calendar, CalendarEvent } from '@calendarpit/server';
import {
  eventFormValues,
  toEventBody,
  toggleAllDay,
  validateEventForm,
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

describe('validateEventForm', () => {
  test('accepts valid values', () => {
    expect(validateEventForm(values())).toBeUndefined();
  });

  test.each([
    [{ end: '2026-10-19T10:00' }, 'end', 'End must be after start.'],
    [{ end: '' }, 'end', 'Enter an end.'],
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
