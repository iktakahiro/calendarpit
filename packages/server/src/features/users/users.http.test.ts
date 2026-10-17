import { expect, test } from 'bun:test';
import { setup } from '../../testing/server-harness';

test('management user CRUD', async () => {
  const s = setup();
  const created = await s.request('/__calendarpit/users', 'POST', {
    id: 'kim',
    name: 'Kim',
    email: 'kim@example.test',
  });
  expect(created.status).toBe(201);
  const renamed = await s.request('/__calendarpit/users/kim', 'PATCH', {
    name: 'Kim Lee',
  });
  expect((await renamed.json()).name).toBe('Kim Lee');
  expect(
    (await s.request('/__calendarpit/users/kim', 'DELETE', {})).status,
  ).toBe(204);
  expect(
    (await s.request('/__calendarpit/users/kim', 'DELETE', {})).status,
  ).toBe(404);
  // A collection POST with an ID in the path is not a create.
  expect(
    (await s.request('/__calendarpit/users/alex', 'POST', {})).status,
  ).toBe(404);
});
