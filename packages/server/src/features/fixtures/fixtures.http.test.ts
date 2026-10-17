import { describe, expect, test } from 'bun:test';
import { defaultFixture } from './fixture';
import { snapshot } from '../status/snapshot-operations';
import { setup } from '../../testing/server-harness';

describe('fixtures and reset', () => {
  test('fixture validation is atomic and reset restores startup data and clears runtime', async () => {
    const s = setup();
    await s.token();
    const before = snapshot(s.app.workspace);
    expect(
      (
        await s.request('/__calendarpit/fixtures', 'POST', {
          ...defaultFixture,
          calendars: [],
        })
      ).status,
    ).toBe(400);
    expect(s.app.workspace.data.users).toEqual(before.users);
    await s.request('/__calendarpit/fixtures', 'POST', {
      users: [],
      calendars: [],
      events: [],
      clients: [],
    });
    expect(s.app.workspace.data.users).toEqual([]);
    await s.request('/__calendarpit/reset', 'POST', {});
    expect(s.app.workspace.data.users.length).toBe(2);
    expect(s.app.workspace.grants.size).toBe(0);
    expect(s.app.workspace.history).toEqual([]);
  });
});
