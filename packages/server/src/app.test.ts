import { describe, expect, test } from 'bun:test';
import { findEvent } from './features/events/event-operations';
import { resetWorkspace } from './features/fixtures/fixture-operations';
import { setup } from './testing/server-harness';

const timed = {
  id: 'test-event',
  summary: 'Busy',
  start: { dateTime: '2026-10-19T10:00:00+09:00' },
  end: { dateTime: '2026-10-19T11:00:00+09:00' },
};
const path = '/calendar/v3/calendars/primary/events';

describe('createCalendarpit', () => {
  test('instance reset and failed mutations cannot change another instance', async () => {
    const a = setup();
    const b = setup();
    const t = await a.token();
    await a.request(path, 'POST', timed, t.access_token);
    expect(b.app.workspace.data.events.map((e) => e.id)).toEqual(['planning']);
    const old = findEvent(a.app.workspace, 'alex-work', 'test-event');
    expect(
      (
        await a.request(
          `${path}/test-event`,
          'PATCH',
          { summary: 'lost update' },
          t.access_token,
          { 'If-Match': 'old-etag' },
        )
      ).status,
    ).toBe(412);
    expect(findEvent(a.app.workspace, 'alex-work', 'test-event').summary).toBe(
      old.summary,
    );
    resetWorkspace(a.app.workspace);
    expect(b.app.workspace.data.events.map((e) => e.id)).toEqual(['planning']);
  });
});
