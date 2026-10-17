import { describe, expect, test } from 'bun:test';
import { calendarIn, eventIn, owner } from '../../testing/records';
import {
  decorate,
  iCalUidOf,
  inTimeZone,
  publicEvent,
} from './event-presentation';

const calendar = calendarIn('Asia/Tokyo');
const base = eventIn(calendar, {
  id: 'meeting',
  start: { dateTime: '2026-10-19T10:00:00+09:00' },
  end: { dateTime: '2026-10-19T11:00:00+09:00' },
});

describe('decorate', () => {
  test('defaults organizer, creator, reminders, and the iCalendar UID', () => {
    const result = decorate(base, owner);
    expect(result.organizer).toEqual({
      email: owner.email,
      displayName: owner.name,
      self: true,
    });
    expect(result.creator?.self).toBe(true);
    expect(result.reminders).toEqual({ useDefault: true });
    expect(result.iCalUID).toBe('meeting@calendarpit.local');
    expect(result.guestsCanInviteOthers).toBe(true);
  });

  test('marks self and organizer attendees case-insensitively', () => {
    const result = decorate(
      {
        ...base,
        organizer: { email: 'Host@Example.test' },
        attendees: [
          { email: 'OWNER@example.test', responseStatus: 'accepted' },
          { email: 'host@example.test', responseStatus: 'accepted' },
        ],
      },
      owner,
    );
    expect(result.organizer?.self).toBe(false);
    expect(
      result.attendees?.map(({ self, organizer }) => ({ self, organizer })),
    ).toEqual([
      { self: true, organizer: false },
      { self: false, organizer: true },
    ]);
  });
});

test('iCalUidOf keeps an explicit UID', () => {
  expect(iCalUidOf({ ...base, iCalUID: 'external@example.test' })).toBe(
    'external@example.test',
  );
});

test('inTimeZone rewrites timed events and leaves all-day events alone', () => {
  expect(inTimeZone(base, 'UTC').start).toEqual({
    dateTime: '2026-10-19T01:00:00+00:00',
    timeZone: 'UTC',
  });
  const allDay = eventIn(calendar, {
    start: { date: '2026-10-19' },
    end: { date: '2026-10-20' },
  });
  expect(inTimeZone(allDay, 'UTC')).toBe(allDay);
});

test('publicEvent removes the internal calendarId', () => {
  expect('calendarId' in publicEvent(base)).toBe(false);
});
