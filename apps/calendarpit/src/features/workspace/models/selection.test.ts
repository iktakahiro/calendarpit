import { expect, test } from 'bun:test';
import type { Snapshot } from '@calendarpit/server';
import { resolveSelection } from './selection';

const snapshot = {
  users: [
    { id: 'alex', name: 'Alex', email: 'alex@example.test' },
    { id: 'sam', name: 'Sam', email: 'sam@example.test' },
  ],
  calendars: [
    {
      id: 'alex-work',
      userId: 'alex',
      summary: 'Work',
      timeZone: 'UTC',
      primary: false,
    },
    {
      id: 'alex-home',
      userId: 'alex',
      summary: 'Home',
      timeZone: 'UTC',
      primary: true,
    },
    {
      id: 'sam-work',
      userId: 'sam',
      summary: 'Work',
      timeZone: 'UTC',
      primary: true,
    },
  ],
} as Snapshot;
const ids = (search: { user?: string; calendar?: string }) => {
  const { user, calendar } = resolveSelection(snapshot, search);
  return [user?.id, calendar?.id];
};

test.each([
  [{}, ['alex', 'alex-home']],
  [{ user: 'sam' }, ['sam', 'sam-work']],
  [{ calendar: 'alex-work' }, ['alex', 'alex-work']],
  [{ user: 'missing', calendar: 'missing' }, ['alex', 'alex-home']],
  // A calendar of another user falls back to the selected user's primary.
  [{ user: 'alex', calendar: 'sam-work' }, ['alex', 'alex-home']],
])('resolves %p', (search, expected) => {
  expect(ids(search)).toEqual(expected);
});

test('is empty before data arrives', () => {
  expect(resolveSelection(undefined, {})).toEqual({
    user: undefined,
    calendars: [],
    calendar: undefined,
  });
});
