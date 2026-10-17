import { fail } from '../../shared/errors';
import { fields, object } from '../../shared/validation';
import type { Fixture } from '../../model/fixture';
import { makeCalendar } from '../calendars/calendar-input';
import { makeEvent } from '../events/event-input';
import { parseClient } from '../oauth/oauth-client';
import { makeUser } from '../users/user-input';

/**
 * Validates fixture data as a whole: every entry, ID uniqueness, calendar
 * owners, event calendars, and exactly one primary calendar per user with
 * calendars.
 *
 * Validation is atomic: the result is a new value and nothing is applied
 * until it succeeds. Event metadata such as `etag` and `updated` is generated
 * with `now`.
 *
 * @param now - Current time in epoch milliseconds.
 * @throws {@link ApiError} 400 describing the first problem found.
 */
export function parseFixture(value: unknown, now: number): Fixture {
  const d = object(value);
  fields(d, ['users', 'calendars', 'events', 'clients']);
  for (const key of ['users', 'calendars', 'events', 'clients'])
    if (d[key] !== undefined && !Array.isArray(d[key]))
      fail(`${key} must be an array.`);
  const users = ((d.users ?? []) as unknown[]).map(makeUser);
  const calendars = ((d.calendars ?? []) as unknown[]).map(makeCalendar);
  for (const calendar of calendars)
    if (!users.some((u) => u.id === calendar.userId))
      fail('Unknown calendar owner.');
  for (const user of users) {
    const owned = calendars.filter((c) => c.userId === user.id);
    if (owned.length && owned.filter((c) => c.primary).length !== 1)
      fail('Each user with calendars must have exactly one primary calendar.');
  }
  const events = ((d.events ?? []) as unknown[]).map((e) => {
    const data = object(e);
    const c = calendars.find((c) => c.id === data.calendarId);
    if (!c) fail('Unknown event calendar.');
    return makeEvent(data, c, now);
  });
  const clients = ((d.clients ?? []) as unknown[]).map(parseClient);
  for (const rows of [users, calendars, clients])
    if (new Set(rows.map((v) => v.id)).size !== rows.length)
      fail('Duplicate fixture ID.');
  if (
    new Set(events.map((e) => JSON.stringify([e.calendarId, e.id]))).size !==
    events.length
  )
    fail('Duplicate event ID.');
  return { users, calendars, events, clients };
}
/**
 * The built-in fixture: two users (`alex` in Tokyo, `sam` in New York), three
 * calendars, one event, and the `sample-app` OAuth client used by the sample
 * consumer.
 */
export const defaultFixture = {
  users: [
    { id: 'alex', name: 'Alex Morgan', email: 'alex@example.test' },
    { id: 'sam', name: 'Sam Rivera', email: 'sam@example.test' },
  ],
  calendars: [
    {
      id: 'alex-work',
      userId: 'alex',
      summary: 'Work calendar',
      timeZone: 'Asia/Tokyo',
      primary: true,
    },
    {
      id: 'alex-personal',
      userId: 'alex',
      summary: 'Personal',
      timeZone: 'Asia/Tokyo',
      primary: false,
    },
    {
      id: 'sam-work',
      userId: 'sam',
      summary: 'Work calendar',
      timeZone: 'America/New_York',
      primary: true,
    },
  ],
  events: [
    {
      id: 'planning',
      calendarId: 'alex-work',
      summary: 'Weekly planning',
      start: { dateTime: '2026-10-19T10:00:00+09:00' },
      end: { dateTime: '2026-10-19T11:00:00+09:00' },
    },
  ],
  clients: [
    {
      id: 'sample-app',
      secret: 'local-sample-secret',
      redirectUris: ['http://127.0.0.1:4175/callback'],
    },
  ],
};
