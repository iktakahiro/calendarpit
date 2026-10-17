import { describe, expect, test } from 'bun:test';
import { defaultFixture, parseFixture } from './fixture';

const user = { id: 'u', name: 'U', email: 'u@example.test' };
const calendar = (id: string, primary: boolean) => ({
  id,
  userId: 'u',
  summary: id,
  primary,
});

test('the built-in fixture is valid', () => {
  const fixture = parseFixture(defaultFixture, 0);
  expect(fixture.users.map((u) => u.id)).toEqual(['alex', 'sam']);
  expect(fixture.events[0]?.etag).toMatch(/^"[0-9a-f-]+"$/);
});

test('missing collections default to empty arrays', () => {
  expect(parseFixture({}, 0)).toEqual({
    users: [],
    calendars: [],
    events: [],
    clients: [],
  });
});

describe('rejections', () => {
  test.each([
    ['a non-array collection', { users: {} }, 'users must be an array.'],
    ['an unknown key', { teams: [] }, 'Unsupported field: teams'],
    [
      'a calendar without its owner',
      { calendars: [calendar('c', true)] },
      'Unknown calendar owner.',
    ],
    [
      'two primary calendars',
      { users: [user], calendars: [calendar('a', true), calendar('b', true)] },
      'Each user with calendars must have exactly one primary calendar.',
    ],
    [
      'no primary calendar',
      { users: [user], calendars: [calendar('a', false)] },
      'Each user with calendars must have exactly one primary calendar.',
    ],
    ['duplicate user IDs', { users: [user, user] }, 'Duplicate fixture ID.'],
    [
      'an event in an unknown calendar',
      {
        events: [
          {
            calendarId: 'missing',
            start: { date: '2026-10-19' },
            end: { date: '2026-10-20' },
          },
        ],
      },
      'Unknown event calendar.',
    ],
    [
      'a client redirect with a fragment',
      {
        clients: [
          { id: 'c', secret: 's', redirectUris: ['http://127.0.0.1/cb#x'] },
        ],
      },
      'Invalid redirect URI.',
    ],
  ])('rejects %s', (_label, value, message) => {
    expect(() => parseFixture(value, 0)).toThrow(message);
  });
});
