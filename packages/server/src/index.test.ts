import { describe, expect, test } from 'bun:test';
import { defaultFixture } from './index';
import { busy, interval, makeEvent, parseFixture } from './model';

import { setup } from './testing/server-harness';
const timed = {
  id: 'test-event',
  summary: 'Busy',
  start: { dateTime: '2026-10-19T10:00:00+09:00' },
  end: { dateTime: '2026-10-19T11:00:00+09:00' },
};
const path = '/calendar/v3/calendars/primary/events';

describe('OAuth and ownership', () => {
  test('denial preserves state and validates redirect before redirecting', async () => {
    const s = setup();
    const redirect = await s.consent(undefined, undefined, 'deny');
    expect(redirect.searchParams.get('error')).toBe('access_denied');
    expect(redirect.searchParams.get('state')).toBe('preserve & = state');
    expect(
      (
        await s.request(
          '/oauth/authorize?client_id=sample-app&redirect_uri=https://evil.test',
        )
      ).status,
    ).toBe(400);
  });
  test('codes are single-use and client/redirect bound', async () => {
    const s = setup();
    const redirect = await s.consent();
    const data = {
      grant_type: 'authorization_code',
      client_id: 'sample-app',
      client_secret: 'local-sample-secret',
      redirect_uri: 'http://127.0.0.1:4175/callback',
      code: redirect.searchParams.get('code')!,
    };
    expect(
      (
        await s.form('/oauth/token', {
          ...data,
          redirect_uri: 'http://invalid.test',
        })
      ).status,
    ).toBe(400);
    expect((await s.form('/oauth/token', data)).status).toBe(200);
    expect((await s.form('/oauth/token', data)).status).toBe(400);
  });
  test('PKCE binds the verifier', async () => {
    const s = setup();
    const verifier = 'a'.repeat(43);
    const redirect = await s.consent(undefined, undefined, undefined, {
      code_challenge: new Bun.CryptoHasher('sha256')
        .update(verifier)
        .digest('base64url'),
      code_challenge_method: 'S256',
    });
    const data = {
      grant_type: 'authorization_code',
      client_id: 'sample-app',
      client_secret: 'local-sample-secret',
      redirect_uri: 'http://127.0.0.1:4175/callback',
      code: redirect.searchParams.get('code')!,
    };
    expect(
      (await s.form('/oauth/token', { ...data, code_verifier: 'wrong' }))
        .status,
    ).toBe(400);
    expect(
      (await s.form('/oauth/token', { ...data, code_verifier: verifier }))
        .status,
    ).toBe(200);
  });
  test('expired access refreshes, then revocation invalidates both tokens', async () => {
    let now = Date.now();
    const s = setup({ now: () => now, accessTokenTtlMs: 1000 });
    const t = await s.token();
    now += 1001;
    expect(
      (await s.request(path, 'GET', undefined, t.access_token)).status,
    ).toBe(401);
    const fresh = await s.form('/oauth/token', {
      grant_type: 'refresh_token',
      client_id: 'sample-app',
      client_secret: 'local-sample-secret',
      refresh_token: t.refresh_token,
    });
    expect(fresh.status).toBe(200);
    const value = await fresh.json();
    expect(
      (await s.request(path, 'GET', undefined, value.access_token)).status,
    ).toBe(200);
    await s.form('/oauth/revoke', { token: t.refresh_token });
    expect(
      (await s.request(path, 'GET', undefined, value.access_token)).status,
    ).toBe(401);
    expect(
      (
        await s.form('/oauth/token', {
          grant_type: 'refresh_token',
          client_id: 'sample-app',
          client_secret: 'local-sample-secret',
          refresh_token: t.refresh_token,
        })
      ).status,
    ).toBe(400);
  });
  test('authorization codes expire', async () => {
    let now = Date.now();
    const s = setup({ now: () => now });
    const redirect = await s.consent();
    now += 60001;
    expect(
      (
        await s.form('/oauth/token', {
          grant_type: 'authorization_code',
          client_id: 'sample-app',
          client_secret: 'local-sample-secret',
          redirect_uri: 'http://127.0.0.1:4175/callback',
          code: redirect.searchParams.get('code')!,
        })
      ).status,
    ).toBe(400);
  });
  test('enforces scope, primary, user-info claims, and owner boundaries', async () => {
    const s = setup();
    const t = await s.token(
      'https://www.googleapis.com/auth/calendar.readonly email',
    );
    expect((await s.request(path, 'POST', timed, t.access_token)).status).toBe(
      403,
    );
    expect(
      (
        await s.request(
          '/calendar/v3/calendars/sam-work',
          'GET',
          undefined,
          t.access_token,
        )
      ).status,
    ).toBe(404);
    const info = await (
      await s.request('/userinfo', 'GET', undefined, t.access_token)
    ).json();
    expect(info.email).toBe('alex@example.test');
    expect(info.name).toBeUndefined();
    const other = await s.token(undefined, 'sam');
    const c = await (
      await s.request(
        '/calendar/v3/calendars/primary',
        'GET',
        undefined,
        other.access_token,
      )
    ).json();
    expect(c.id).toBe('sam-work');
  });
});
describe('calendar behavior', () => {
  test('CRUD, replacement, cancellation and free/busy remain consistent', async () => {
    const s = setup();
    const { access_token: t } = await s.token();
    expect((await s.request(path, 'POST', timed, t)).status).toBe(200);
    const free = () =>
      s
        .request(
          '/calendar/v3/freeBusy',
          'POST',
          {
            timeMin: '2026-10-19T01:30:00Z',
            timeMax: '2026-10-19T03:00:00Z',
            items: [{ id: 'primary' }],
          },
          t,
        )
        .then((r) => r.json());
    expect((await free()).calendars.primary.busy).toEqual([
      { start: '2026-10-19T01:30:00+00:00', end: '2026-10-19T02:00:00+00:00' },
    ]);
    await s.request(
      `${path}/test-event`,
      'PATCH',
      { description: 'keep', extendedProperties: { private: { appId: '42' } } },
      t,
    );
    const patched = await (
      await s.request(`${path}/test-event`, 'GET', undefined, t)
    ).json();
    expect(patched.summary).toBe('Busy');
    expect(patched.extendedProperties.private.appId).toBe('42');
    await s.request(
      `${path}/test-event`,
      'PUT',
      { start: timed.start, end: timed.end, transparency: 'transparent' },
      t,
    );
    const replaced = await (
      await s.request(`${path}/test-event`, 'GET', undefined, t)
    ).json();
    expect(replaced.description).toBeUndefined();
    expect(replaced.summary).toBe('');
    await s.request(`${path}/planning`, 'DELETE', undefined, t);
    expect((await free()).calendars.primary.busy).toEqual([]);
    await s.request(`${path}/test-event`, 'DELETE', undefined, t);
    expect(
      (
        await (
          await s.request(`${path}/test-event`, 'GET', undefined, t)
        ).json()
      ).status,
    ).toBe('cancelled');
  });
  test('list uses exclusive boundaries, stable pagination during concurrent writes', async () => {
    const s = setup();
    const { access_token: t } = await s.token();
    await s.request(
      path,
      'POST',
      {
        ...timed,
        id: 'later',
        start: { dateTime: '2026-10-19T11:00:00+09:00' },
        end: { dateTime: '2026-10-19T12:00:00+09:00' },
      },
      t,
    );
    const list = await (
      await s.request(
        `${path}?timeMin=2026-10-19T02:00:00Z&timeMax=2026-10-19T03:00:00Z`,
        'GET',
        undefined,
        t,
      )
    ).json();
    expect(list.items.map((e: { id: string }) => e.id)).toEqual(['later']);
    const first = await (
      await s.request(
        `${path}?maxResults=1&orderBy=startTime&singleEvents=true`,
        'GET',
        undefined,
        t,
      )
    ).json();
    expect(first.items[0].id).toBe('planning');
    const next = `${path}?maxResults=1&orderBy=startTime&singleEvents=true&pageToken=${first.nextPageToken}`;
    expect(
      (await (await s.request(next, 'GET', undefined, t)).json()).items[0].id,
    ).toBe('later');
    await s.request(`${path}/later`, 'PATCH', { summary: 'changed' }, t);
    expect(
      (await (await s.request(next, 'GET', undefined, t)).json()).items[0]
        .summary,
    ).not.toBe('changed');
  });
  test('rejects unsupported recurrence, fields and invalid dates without mutation', async () => {
    const s = setup();
    const { access_token: t } = await s.token();
    for (const body of [
      { ...timed, recurrence: ['RRULE:FREQ=DAILY'] },
      { ...timed, unsupportedProperty: true },
      { ...timed, start: { date: '2026-02-30' }, end: { date: '2026-03-01' } },
      { ...timed, end: timed.start },
    ])
      expect((await s.request(path, 'POST', body, t)).status).toBe(400);
    expect(
      (await s.request(`${path}?syncToken=old`, 'GET', undefined, t)).status,
    ).toBe(410);
    expect(s.app.store.data.events.length).toBe(1);
  });
  test('merge overlaps, clip, exclude free/cancelled, handle DST all-day durations', () => {
    const c = parseFixture(defaultFixture, 0).calendars.find(
      (c) => c.id === 'sam-work',
    )!;
    const spring = makeEvent(
      { start: { date: '2026-03-08' }, end: { date: '2026-03-09' } },
      c,
      0,
    );
    expect(interval(spring, c)[1] - interval(spring, c)[0]).toBe(23 * 3600000);
    const fall = makeEvent(
      { start: { date: '2026-11-01' }, end: { date: '2026-11-02' } },
      c,
      0,
    );
    expect(interval(fall, c)[1] - interval(fall, c)[0]).toBe(25 * 3600000);
    const a = makeEvent(
      {
        start: { dateTime: '2026-03-08T06:00:00Z' },
        end: { dateTime: '2026-03-08T08:00:00Z' },
      },
      c,
      0,
    );
    const b = makeEvent(
      {
        start: { dateTime: '2026-03-08T07:00:00Z' },
        end: { dateTime: '2026-03-08T09:00:00Z' },
      },
      c,
      0,
    );
    expect(
      busy(
        [
          a,
          b,
          { ...spring, transparency: 'transparent' },
          { ...spring, status: 'cancelled' },
        ],
        c,
        Date.parse('2026-03-08T06:30:00Z'),
        Date.parse('2026-03-08T08:30:00Z'),
      ),
    ).toEqual([
      { start: '2026-03-08T06:30:00.000Z', end: '2026-03-08T08:30:00.000Z' },
    ]);
  });
  test('rejects ambiguous local times and honors explicit event time zones', () => {
    const c = parseFixture(defaultFixture, 0).calendars[0]!;
    expect(() =>
      makeEvent(
        {
          start: {
            dateTime: '2026-11-01T01:30:00',
            timeZone: 'America/New_York',
          },
          end: {
            dateTime: '2026-11-01T03:00:00',
            timeZone: 'America/New_York',
          },
        },
        c,
        0,
      ),
    ).toThrow();
    const e = makeEvent(
      {
        start: { dateTime: '2026-10-19T10:00:00', timeZone: 'Asia/Tokyo' },
        end: { dateTime: '2026-10-19T11:00:00', timeZone: 'Asia/Tokyo' },
      },
      c,
      0,
    );
    expect(interval(e, c)[0]).toBe(Date.parse('2026-10-19T01:00:00Z'));
  });
});
describe('management and watch', () => {
  test('fixture validation is atomic and reset restores startup data and clears runtime', async () => {
    const s = setup();
    await s.token();
    const before = s.app.store.snapshot();
    expect(
      (
        await s.request('/__calendarpit/fixtures', 'POST', {
          ...defaultFixture,
          calendars: [],
        })
      ).status,
    ).toBe(400);
    expect(s.app.store.data.users).toEqual(before.users);
    await s.request('/__calendarpit/fixtures', 'POST', {
      users: [],
      calendars: [],
      events: [],
      clients: [],
    });
    expect(s.app.store.data.users).toEqual([]);
    await s.request('/__calendarpit/reset', 'POST', {});
    expect(s.app.store.data.users.length).toBe(2);
    expect(s.app.store.grants.size).toBe(0);
    expect(s.app.store.history).toEqual([]);
  });
  test('management CRUD maintains primary invariants and rejects cross-origin writes', async () => {
    const s = setup();
    expect(
      (
        await s.request('/__calendarpit/reset', 'POST', {}, undefined, {
          Origin: 'https://evil.test',
        })
      ).status,
    ).toBe(403);
    const c = await (
      await s.request('/__calendarpit/calendars', 'POST', {
        id: 'new',
        userId: 'alex',
        summary: 'New',
        primary: true,
        timeZone: 'UTC',
      })
    ).json();
    expect(c.primary).toBe(true);
    expect(s.app.store.calendar('alex-work').primary).toBe(false);
    await s.request('/__calendarpit/calendars/new', 'DELETE', {});
    expect(s.app.store.calendar('primary', 'alex').id).toBe('alex-work');
  });
  test('history masks tokens, client secrets, codes and callback state', async () => {
    const s = setup();
    const t = await s.token();
    await s.request(path, 'GET', undefined, t.access_token);
    const log = JSON.stringify(s.app.store.history);
    expect(log).not.toContain(t.access_token);
    expect(log).not.toContain(t.refresh_token);
    expect(log).not.toContain('local-sample-secret');
    expect(log).toContain('[REDACTED]');
  });
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
    await s.app.store.drain();
    expect(messages.map((h) => h.get('X-Goog-Resource-State'))).toEqual([
      'sync',
      'exists',
    ]);
    expect(messages.map((h) => h.get('X-Goog-Message-Number'))).toEqual([
      '1',
      '2',
    ]);
    expect(messages[0]!.get('X-Goog-Channel-Token')).toBe('channel-secret');
    expect(JSON.stringify(s.app.store.history)).not.toContain('channel-secret');
    await s.request(
      '/calendar/v3/channels/stop',
      'POST',
      { id: channel.id, resourceId: channel.resourceId },
      t,
    );
    await s.request(`${path}/test-event`, 'DELETE', undefined, t);
    await s.app.store.drain();
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
    await s.app.store.drain();
    expect(calls).toBe(3);
    expect(s.app.store.deliveries[0]!.status).toBe('failed');
    now += 1001;
    await s.request(path, 'POST', timed, t);
    await s.app.store.drain();
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
    s.app.store.reset();
    await s.app.store.drain();
    expect(calls).toBe(1);
    expect(s.app.store.deliveries).toEqual([]);
    expect(s.app.store.channels.size).toBe(0);
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
    s.app.store.revoke([...s.app.store.grants.keys()][0]!);
    await s.app.store.drain();
    expect(s.app.store.channels.size).toBe(0);
  });
});

test('partial extended properties preserve other keys and null deletes a key', () => {
  const c = parseFixture(defaultFixture, 0).calendars[0]!;
  const original = makeEvent(
    {
      ...timed,
      extendedProperties: {
        private: { keep: 'yes', remove: 'old' },
        shared: { shared: 'yes' },
      },
    },
    c,
    0,
  );
  const result = makeEvent(
    { extendedProperties: { private: { remove: null, added: 'new' } } },
    c,
    1,
    original,
    true,
  );
  expect(result.extendedProperties).toEqual({
    private: { keep: 'yes', added: 'new' },
    shared: { shared: 'yes' },
  });
});

test('consent headers preserve same-origin form Origin and permit the registered callback', async () => {
  const s = setup();
  const params = new URLSearchParams({
    client_id: 'sample-app',
    redirect_uri: 'http://127.0.0.1:4175/callback',
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/calendar',
  });
  const response = await s.request(`/oauth/authorize?${params}`);
  expect(response.headers.get('referrer-policy')).toBe('same-origin');
  expect(response.headers.get('content-security-policy')).toContain(
    "form-action 'self' http://127.0.0.1:4175",
  );
  expect(
    (await s.request(`/oauth/authorize?${params}&prompt=none`)).status,
  ).toBe(400);
});

test('instance reset and failed mutations cannot change another instance', async () => {
  const a = setup();
  const b = setup();
  const t = await a.token();
  await a.request(path, 'POST', timed, t.access_token);
  expect(b.app.store.data.events.map((e) => e.id)).toEqual(['planning']);
  const old = a.app.store.event('alex-work', 'test-event');
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
  expect(a.app.store.event('alex-work', 'test-event').summary).toBe(
    old.summary,
  );
  a.app.store.reset();
  expect(b.app.store.data.events.map((e) => e.id)).toEqual(['planning']);
});
