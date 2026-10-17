import { describe, expect, test } from 'bun:test';
import { setup } from '../../testing/server-harness';

const path = '/calendar/v3/calendars/primary/events';

describe('protocol history', () => {
  test('history masks tokens, client secrets, codes and callback state', async () => {
    const s = setup();
    const t = await s.token();
    await s.request(path, 'GET', undefined, t.access_token);
    const log = JSON.stringify(s.app.workspace.history);
    expect(log).not.toContain(t.access_token);
    expect(log).not.toContain(t.refresh_token);
    expect(log).not.toContain('local-sample-secret');
    expect(log).toContain('[REDACTED]');
  });
});

test('clearing history empties the log', async () => {
  const s = setup();
  await s.request('/calendar/v3/users/me/calendarList');
  expect(
    (await (await s.request('/__calendarpit/history')).json()).length,
  ).toBe(1);
  expect((await s.request('/__calendarpit/history', 'DELETE', {})).status).toBe(
    204,
  );
  expect(await (await s.request('/__calendarpit/history')).json()).toEqual([]);
});
