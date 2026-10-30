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
  describe('delivery failure reason', () => {
    const watch = (
      s: ReturnType<typeof setup>,
      t: string,
      address = 'http://127.0.0.1:5555/hook',
    ) =>
      s.request(
        `${path}/watch`,
        'POST',
        { id: 'reasons', type: 'web_hook', address, token: 'channel-secret' },
        t,
      );

    test('records a timeout and a network error', async () => {
      for (const [error, failure] of [
        [
          new DOMException('The operation timed out.', 'TimeoutError'),
          'timeout',
        ],
        [new TypeError('Unable to connect'), 'network'],
      ] as const) {
        const s = setup({
          retryDelayMs: 1,
          deliver: async () => {
            throw error;
          },
        });
        const { access_token: t } = await s.token();
        await watch(s, t);
        await s.app.drain();
        const [delivery] = s.app.workspace.deliveries;
        expect(delivery).toMatchObject({
          attempts: 3,
          status: 'failed',
          failure,
        });
        expect(delivery!.httpStatus).toBeUndefined();
      }
    });

    test('records a callback that no longer passes the allowlist', async () => {
      let calls = 0;
      const s = setup({
        retryDelayMs: 1,
        allowedWatchHosts: ['hook.test'],
        deliver: async () => {
          calls++;
          return new Response(null, { status: 204 });
        },
      });
      const { access_token: t } = await s.token();
      await watch(s, t, 'http://hook.test/hook');
      await s.app.drain();
      expect(calls).toBe(1);
      s.app.workspace.options.allowedWatchHosts = [];
      await s.request(path, 'POST', timed, t);
      await s.app.drain();
      expect(calls).toBe(1);
      expect(s.app.workspace.deliveries[1]).toMatchObject({
        attempts: 3,
        status: 'failed',
        failure: 'callbackRejected',
      });
    });

    test('a later HTTP response replaces the reason', async () => {
      const outcomes = [
        () => {
          throw new DOMException('The operation timed out.', 'TimeoutError');
        },
        () => new Response(null, { status: 503 }),
        () => new Response(null, { status: 204 }),
      ];
      const s = setup({
        retryDelayMs: 1,
        deliver: async () => outcomes.shift()!(),
      });
      const { access_token: t } = await s.token();
      await watch(s, t);
      await s.app.drain();
      expect(s.app.workspace.deliveries[0]).toMatchObject({
        attempts: 3,
        status: 'delivered',
        httpStatus: 204,
      });
      expect(s.app.workspace.deliveries[0]!.failure).toBeUndefined();
    });

    test('keeps an earlier HTTP status beside the last attempt failure', async () => {
      const outcomes = [
        () => new Response(null, { status: 503 }),
        () => {
          throw new TypeError('Unable to connect');
        },
        () => {
          throw new DOMException('The operation timed out.', 'TimeoutError');
        },
      ];
      const s = setup({
        retryDelayMs: 1,
        deliver: async () => outcomes.shift()!(),
      });
      const { access_token: t } = await s.token();
      await watch(s, t);
      await s.app.drain();
      expect(s.app.workspace.deliveries[0]).toMatchObject({
        attempts: 3,
        status: 'failed',
        httpStatus: 503,
        failure: 'timeout',
      });
    });

    test('keeps no error text or credentials', async () => {
      const s = setup({
        retryDelayMs: 1,
        deliver: async () => {
          throw new TypeError('connect failed http://u:p@127.0.0.1:5555/hook');
        },
      });
      const { access_token: t } = await s.token();
      await watch(s, t);
      await s.app.drain();
      const text = JSON.stringify(s.app.workspace.deliveries);
      expect(text).not.toContain('connect failed');
      expect(text).not.toContain('channel-secret');
      expect(text).not.toContain('5555');
    });

    test('a stopped channel ends cancelled without a reason', async () => {
      const s = setup({
        retryDelayMs: 1,
        deliver: (_url, init) =>
          new Promise((_resolve, reject) =>
            init.signal!.addEventListener(
              'abort',
              () => reject(new Error('aborted')),
              { once: true },
            ),
          ),
      });
      const { access_token: t } = await s.token();
      const channel = await (await watch(s, t)).json();
      await s.request(
        '/calendar/v3/channels/stop',
        'POST',
        { id: channel.id, resourceId: channel.resourceId },
        t,
      );
      await s.app.drain();
      expect(s.app.workspace.deliveries[0]!.status).toBe('cancelled');
      expect(s.app.workspace.deliveries[0]!.failure).toBeUndefined();
    });
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
