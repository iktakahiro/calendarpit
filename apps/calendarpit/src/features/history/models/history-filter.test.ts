import { expect, test } from 'bun:test';
import type { History } from '@calendarpit/server';
import { area, filterHistory, statusClass } from './history-filter';

const row = (id: string, method: string, path: string, status: number) =>
  ({ id, method, path, status }) as History;
const history = [
  row('1', 'GET', '/calendar/v3/users/me/calendarList', 200),
  row('2', 'POST', '/oauth/token', 400),
  row('3', 'GET', '/calendar/v3/calendars/primary/events', 401),
];
const ids = (rows: History[]) => rows.map((r) => r.id);

test.each([
  ['', false, ['3', '2', '1']],
  ['', true, ['3', '2']],
  ['OAUTH', false, ['2']],
  ['401', false, ['3']],
  ['get', true, ['3']],
])('filter %p (errors only: %p)', (query, errorsOnly, expected) => {
  expect(ids(filterHistory(history, query, errorsOnly))).toEqual(expected);
});

test.each([
  [204, 'status-2xx'],
  [302, 'status-3xx'],
  [404, 'status-4xx'],
  [503, 'status-5xx'],
])('statusClass(%i)', (status, expected) => {
  expect(statusClass(status)).toBe(expected);
});

test('area labels Calendar and OAuth paths', () => {
  expect(area('/calendar/v3/freeBusy')).toBe('Calendar');
  expect(area('/oauth/revoke')).toBe('OAuth');
  expect(area('/userinfo')).toBe('');
});
