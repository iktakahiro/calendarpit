import { describe, expect, test } from 'bun:test';
import { resetWorkspace } from '../fixtures/fixture-operations';
import { revokeGrant } from '../oauth/oauth-operations';
import { setup } from '../../testing/server-harness';

const timed = {
  id: 'test-event',
  summary: 'Busy',
  start: { dateTime: '2026-10-19T10:00:00+09:00' },
  end: { dateTime: '2026-10-19T11:00:00+09:00' },
};
const path = '/calendar/v3/calendars/primary/events';

describe('watch', () => {
  test('watch sends ordered sync and mutation messages, then stops', async () => {
    const messages: Headers[] = [];
    const s = setup({
      deliver: async (_url, init) => {
        messages.push(new Headers(init?.headers));
        return new Response(null, { status: 204 });
      },
    });
    const { access_token: t } = await s.token();
    const channel = await (
      await s.request(
        `${path}/watch`,
        'POST',
        {
          id: 'channel',
          type: 'web_hook',
          address: 'http://127.0.0.1:5555/hook',
          token: 'channel-secret',
        },
        t,
      )
    ).json();
    await s.request(path, 'POST', timed, t);
    await s.app.drain();
    expect(messages.map((h) => h.get('X-Goog-Resource-State'))).toEqual([
      'sync',
      'exists',
    ]);
    expect(messages.map((h) => h.get('X-Goog-Message-Number'))).toEqual([
      '1',
      '2',
    ]);
    expect(messages[0]!.get('X-Goog-Channel-Token')).toBe('channel-secret');
    expect(JSON.stringify(s.app.workspace.history)).not.toContain(
      'channel-secret',
    );
    await s.request(
      '/calendar/v3/channels/stop',
      'POST',
      { id: channel.id, resourceId: channel.resourceId },
      t,
    );
    await s.request(`${path}/test-event`, 'DELETE', undefined, t);
    await s.app.drain();
    expect(messages.length).toBe(2);
  });
  test('watch restricts destinations, retries failures and expires', async () => {
    let now = Date.now();
    let calls = 0;
    const s = setup({
      now: () => now,
      retryDelayMs: 1,
      deliver: async () => {
        calls++;
        return new Response(null, { status: 500 });
      },
    });
    const { access_token: t } = await s.token();
    expect(
      (
        await s.request(
          `${path}/watch`,
          'POST',
          { id: 'bad', type: 'web_hook', address: 'http://169.254.169.254/' },
          t,
        )
      ).status,
    ).toBe(400);
    await s.request(
      `${path}/watch`,
      'POST',
      {
        id: 'failed',
        type: 'web_hook',
        address: 'http://localhost:5555',
        expiration: String(now + 1000),
      },
      t,
    );
    await s.app.drain();
    expect(calls).toBe(3);
    expect(s.app.workspace.deliveries[0]!.status).toBe('failed');
    now += 1001;
    await s.request(path, 'POST', timed, t);
    await s.app.drain();
    expect(calls).toBe(3);
  });
  test('reset aborts in-flight delivery and prevents retries and stale state', async () => {
    let calls = 0;
    let started!: () => void;
    const ready = new Promise<void>((r) => (started = r));
    const s = setup({
      deliver: (_, init) =>
        new Promise((_resolve, reject) => {
          calls++;
          started();
          init!.signal!.addEventListener(
            'abort',
            () => reject(Error('aborted')),
            { once: true },
          );
        }),
    });
    const { access_token: t } = await s.token();
    await s.request(
      `${path}/watch`,
      'POST',
      { id: 'pending', type: 'web_hook', address: 'http://127.0.0.1:5555' },
      t,
    );
    await ready;
    resetWorkspace(s.app.workspace);
    await s.app.drain();
    expect(calls).toBe(1);
    expect(s.app.workspace.deliveries).toEqual([]);
    expect(s.app.workspace.channels.size).toBe(0);
  });
  test('revoking a connection cancels its watch channels', async () => {
    const s = setup({
      deliver: async () => new Response(null, { status: 204 }),
    });
    const { access_token: t } = await s.token();
    await s.request(
      `${path}/watch`,
      'POST',
      { id: 'revoked', type: 'web_hook', address: 'http://127.0.0.1:5555' },
      t,
    );
    revokeGrant(s.app.workspace, [...s.app.workspace.grants.keys()][0]!);
    await s.app.drain();
    expect(s.app.workspace.channels.size).toBe(0);
  });
});
