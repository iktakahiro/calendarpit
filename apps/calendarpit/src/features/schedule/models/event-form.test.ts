import { describe, expect, test } from 'bun:test';
import type { Calendar, CalendarEvent } from '@calendarpit/server';
import {
  datePart,
  eventFormValues,
  fieldsRemovedBySave,
  timePart,
  toEventBody,
  toggleAllDay,
  validateEventForm,
  withDate,
  withTime,
  type EventFormValues,
  type RemovedField,
} from './event-form';
import { messages } from '../../../lib/messages';

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

describe('toggleAllDay', () => {
  test('turns all-day on with an exclusive end one day after the start', () => {
    expect(
      toggleAllDay(
        { start: '2026-10-19T09:15', end: '2026-10-22T17:00' },
        true,
      ),
    ).toEqual({ start: '2026-10-19', end: '2026-10-20' });
  });

  test.each([
    ['2026-10-20', '2026-10-19T11:00'],
    ['2026-10-22', '2026-10-21T11:00'],
  ])(
    'turns all-day off using the last included date for end %p',
    (end, expected) => {
      expect(toggleAllDay({ start: '2026-10-19', end }, false)).toEqual({
        start: '2026-10-19T10:00',
        end: expected,
      });
    },
  );

  test('keeps the date of an end that already has a time', () => {
    expect(
      toggleAllDay(
        { start: '2026-10-19T09:15', end: '2026-10-22T17:00' },
        false,
      ),
    ).toEqual({ start: '2026-10-19T10:00', end: '2026-10-22T11:00' });
  });

  test.each(['2026-10-19', '2026-10-18'])(
    'clamps an exclusive end %p at or before the start to the start date',
    (end) => {
      expect(toggleAllDay({ start: '2026-10-19', end }, false)).toEqual({
        start: '2026-10-19T10:00',
        end: '2026-10-19T11:00',
      });
    },
  );

  test('round trips a one-hour event through all-day on the same date', () => {
    const timed = { start: '2026-10-19T10:00', end: '2026-10-19T11:00' };
    expect(toggleAllDay(toggleAllDay(timed, true), false)).toEqual(timed);
  });
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
    expect(validateEventForm(values(), messages.en)).toBeUndefined();
  });

  test('accepts dates without times when the event is all-day', () => {
    expect(
      validateEventForm(
        values({ allDay: true, start: '2026-10-19', end: '2026-10-20' }),
        messages.en,
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
    expect(validateEventForm(values(overrides), messages.en)).toEqual({
      [field]: message,
    });
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

describe('fieldsRemovedBySave', () => {
  const plain = {
    id: 'plain',
    summary: 'Plain',
    start: { dateTime: '2026-10-19T01:00:00Z' },
    end: { dateTime: '2026-10-19T02:00:00Z' },
  } as CalendarEvent;
  const event = (extra: Partial<CalendarEvent>): CalendarEvent => ({
    ...plain,
    ...extra,
  });

  test('reports nothing for a plain event', () => {
    expect(fieldsRemovedBySave(plain)).toEqual([]);
  });

  test.each([
    ['recurrence', { recurrence: ['RRULE:FREQ=WEEKLY'] }],
    [
      'attendees',
      {
        attendees: [
          { email: 'sam@example.test', responseStatus: 'needsAction' },
        ],
      },
    ],
    ['conferenceData', { conferenceData: { conferenceId: 'abc-defg-hij' } }],
    ['colorId', { colorId: '5' }],
    ['visibility', { visibility: 'private' }],
    [
      'reminders',
      {
        reminders: {
          useDefault: false,
          overrides: [{ method: 'popup', minutes: 10 }],
        },
      },
    ],
  ] satisfies [RemovedField, Partial<CalendarEvent>][])(
    'reports %s',
    (field, extra) => {
      expect(fieldsRemovedBySave(event(extra))).toEqual([field]);
    },
  );

  test('lists several fields in a stable order', () => {
    expect(
      fieldsRemovedBySave(
        event({
          reminders: { useDefault: false },
          colorId: '2',
          recurrence: ['RRULE:FREQ=DAILY'],
        }),
      ),
    ).toEqual(['recurrence', 'colorId', 'reminders']);
  });

  test('does not count values a save already leaves behind', () => {
    expect(
      fieldsRemovedBySave(
        event({
          recurrence: [],
          attendees: [],
          conferenceData: {},
          visibility: 'default',
          reminders: { useDefault: true },
        }),
      ),
    ).toEqual([]);
  });
});
