import { afterEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createCalendarpit,
  defaultFixture,
  type WorkspaceOptions,
} from '../index';
import { snapshot } from '../features/status/snapshot-operations';
import { findEvent } from '../features/events/event-operations';

const directories: string[] = [];
const instances: ReturnType<typeof createCalendarpit>[] = [];
function file() {
  const directory = mkdtempSync(join(tmpdir(), 'calendarpit-storage-'));
  directories.push(directory);
  return join(directory, 'nested', 'workspace.sqlite');
}
function open(database: string, options: WorkspaceOptions = {}) {
  const app = createCalendarpit({ ...options, database });
  instances.push(app);
  const request = async (
    path: string,
    method = 'GET',
    body?: unknown,
    token?: string,
  ) => {
    const response = await app.handle(
      new Request(`http://127.0.0.1:4173${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );
    return response!;
  };
  const form = async (path: string, body: Record<string, string>) =>
    (await app.handle(
      new Request(`http://127.0.0.1:4173${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(body),
      }),
    ))!;
  const authorize = async () => {
    const params = new URLSearchParams({
      client_id: 'sample-app',
      redirect_uri: 'http://127.0.0.1:4175/callback',
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/calendar',
      access_type: 'offline',
    });
    const page = await request(`/oauth/authorize?${params}`);
    const nonce = /name="consent" value="([^"]+)"/.exec(await page.text())![1]!;
    const response = await form('/oauth/authorize', {
      consent: nonce,
      user_id: 'alex',
      decision: 'approve',
    });
    const code = new URL(response.headers.get('location')!).searchParams.get(
      'code',
    )!;
    const tokens = await form('/oauth/token', {
      grant_type: 'authorization_code',
      client_id: 'sample-app',
      client_secret: 'local-sample-secret',
      redirect_uri: 'http://127.0.0.1:4175/callback',
      code,
    });
    expect(tokens.status).toBe(200);
    return (await tokens.json()) as {
      access_token: string;
      refresh_token: string;
    };
  };
  return { app, request, form, authorize };
}
afterEach(async () => {
  for (const app of instances) app.close();
  await Promise.all(instances.map((app) => app.drain()));
  instances.length = 0;
  for (const directory of directories)
    rmSync(directory, { recursive: true, force: true });
  directories.length = 0;
});
const eventPath = '/__calendarpit/calendars/alex-work/events';
const event = {
  id: 'saved-event',
  summary: 'Saved meeting',
  start: { dateTime: '2026-10-19T12:00:00+09:00' },
  end: { dateTime: '2026-10-19T13:00:00+09:00' },
};

describe('SQLite persistence', () => {
  test('reopens data with stable metadata and the original reset baseline', async () => {
    const database = file();
    const first = open(database);
    const baseline = structuredClone(first.app.workspace.startup);
    expect((await first.request(eventPath, 'POST', event)).status).toBe(200);
    expect(
      (
        await first.request('/__calendarpit/users', 'POST', {
          id: 'saved-user',
          name: 'Saved user',
          email: 'saved@example.test',
        })
      ).status,
    ).toBe(201);
    const before = snapshot(first.app.workspace);
    first.app.close();
    const second = open(database, {
      fixture: { users: [], calendars: [], events: [], clients: [] },
    });
    expect(snapshot(second.app.workspace).events).toEqual(before.events);
    expect(snapshot(second.app.workspace).users).toEqual(before.users);
    expect(second.app.workspace.startup).toEqual(baseline);
    expect((await second.request('/__calendarpit/health')).status).toBe(200);
    expect(
      await (await second.request('/__calendarpit/health')).json(),
    ).toMatchObject({ storage: 'sqlite' });
    expect(
      (
        await second.request(`${eventPath}/saved-event`, 'PATCH', {
          summary: 'Updated',
        })
      ).status,
    ).toBe(200);
    second.app.close();
    const third = open(database);
    expect(
      findEvent(third.app.workspace, 'alex-work', 'saved-event').summary,
    ).toBe('Updated');
    await third.request(`${eventPath}/saved-event`, 'DELETE');
    third.app.close();
    const fourth = open(database);
    expect(
      fourth.app.workspace.data.events.some(
        (e) => e.id === 'saved-event' && e.status !== 'cancelled',
      ),
    ).toBe(false);
    await fourth.request('/__calendarpit/reset', 'POST', {});
    fourth.app.close();
    expect(open(database).app.workspace.data).toEqual(baseline);
  });

  test('restores OAuth tokens and history; revocation and reset survive restart', async () => {
    const database = file();
    let current = open(database);
    const tokens = await current.authorize();
    const grantId = [...current.app.workspace.grants.keys()][0]!;
    current.app.close();
    current = open(database);
    expect(current.app.workspace.history.length).toBeGreaterThan(0);
    expect(JSON.stringify(current.app.workspace.history)).not.toContain(
      tokens.access_token,
    );
    expect(
      (
        await current.request(
          '/calendar/v3/users/me/calendarList',
          'GET',
          undefined,
          tokens.access_token,
        )
      ).status,
    ).toBe(200);
    const refreshed = await current.form('/oauth/token', {
      grant_type: 'refresh_token',
      client_id: 'sample-app',
      client_secret: 'local-sample-secret',
      refresh_token: tokens.refresh_token,
    });
    expect(refreshed.status).toBe(200);
    await current.request(
      `/__calendarpit/connections/${grantId}/revoke`,
      'POST',
      {},
    );
    current.app.close();
    current = open(database);
    expect(
      (
        await current.request(
          '/calendar/v3/users/me/calendarList',
          'GET',
          undefined,
          tokens.access_token,
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await current.form('/oauth/token', {
          grant_type: 'refresh_token',
          client_id: 'sample-app',
          client_secret: 'local-sample-secret',
          refresh_token: tokens.refresh_token,
        })
      ).status,
    ).toBe(400);
    await current.authorize();
    await current.request('/__calendarpit/reset', 'POST', {});
    current.app.close();
    current = open(database);
    expect(current.app.workspace.grants.size).toBe(0);
    expect(current.app.workspace.access.size).toBe(0);
    expect(current.app.workspace.refresh.size).toBe(0);
    expect(current.app.workspace.history).toEqual([]);
  });

  test('resumes active watch channels and message numbering for admin mutations', async () => {
    const database = file();
    const messages: Headers[] = [];
    const deliver: WorkspaceOptions['deliver'] = async (_url, init) => {
      messages.push(new Headers(init.headers));
      return new Response(null, { status: 204 });
    };
    let current = open(database, { deliver });
    const { access_token } = await current.authorize();
    const watched = await current.request(
      '/calendar/v3/calendars/primary/events/watch',
      'POST',
      {
        id: 'saved-watch',
        type: 'web_hook',
        address: 'http://127.0.0.1:5555/hook',
        token: 'channel-secret',
      },
      access_token,
    );
    const channel = await watched.json();
    expect(watched.status).toBe(200);
    await current.app.drain();
    expect(messages[0]!.get('X-Goog-Resource-State')).toBe('sync');
    current.app.close();
    current = open(database, { deliver });
    expect(messages.length).toBe(1);
    await current.request(eventPath, 'POST', event);
    await current.app.drain();
    expect(messages[1]!.get('X-Goog-Message-Number')).toBe('2');
    expect(messages[1]!.get('X-Goog-Resource-ID')).toBe(channel.resourceId);
    expect(messages[1]!.get('X-Goog-Channel-Token')).toBe('channel-secret');
    expect(snapshot(current.app.workspace).channels[0]!.token).toBe(
      '[REDACTED]',
    );
    await current.request(
      '/calendar/v3/channels/stop',
      'POST',
      { id: channel.id, resourceId: channel.resourceId },
      access_token,
    );
    current.app.close();
    current = open(database, { deliver });
    expect(current.app.workspace.channels.size).toBe(0);
    expect(current.app.workspace.deliveries.map((d) => d.status)).toEqual([
      'delivered',
      'delivered',
    ]);
  });

  test('keeps the delivery failure reason after reopening', async () => {
    const database = file();
    const deliver: WorkspaceOptions['deliver'] = async () => {
      throw new TypeError('Unable to connect');
    };
    let current = open(database, { deliver, retryDelayMs: 1 });
    const { access_token } = await current.authorize();
    await current.request(
      '/calendar/v3/calendars/primary/events/watch',
      'POST',
      {
        id: 'unreachable',
        type: 'web_hook',
        address: 'http://127.0.0.1:5555/hook',
      },
      access_token,
    );
    await current.app.drain();
    current.app.close();
    current = open(database);
    expect(current.app.workspace.deliveries[0]).toMatchObject({
      status: 'failed',
      failure: 'network',
    });
    expect(snapshot(current.app.workspace).deliveries[0]!.failure).toBe(
      'network',
    );
  });

  test('closing cancels pending deliveries without deleting the subscription', async () => {
    const database = file();
    const first = open(database, {
      deliver: (_url, init) =>
        new Promise((_resolve, reject) =>
          init.signal!.addEventListener(
            'abort',
            () => reject(new Error('aborted')),
            { once: true },
          ),
        ),
    });
    const { access_token } = await first.authorize();
    await first.request(
      '/calendar/v3/calendars/primary/events/watch',
      'POST',
      {
        id: 'pending',
        type: 'web_hook',
        address: 'http://127.0.0.1:5555/hook',
      },
      access_token,
    );
    first.app.close();
    const second = open(database);
    await first.app.drain();
    expect(second.app.workspace.deliveries[0]!.status).toBe('cancelled');
    expect(second.app.workspace.deliveries[0]!.failure).toBeUndefined();
    expect(second.app.workspace.channels.size).toBe(1);
    await second.request('/__calendarpit/reset', 'POST', {});
    second.app.close();
    expect(open(database).app.workspace.deliveries).toEqual([]);
  });

  test('expired tokens and channels stay expired after reopening', async () => {
    const database = file();
    let now = Date.now();
    let current = open(database, { now: () => now, accessTokenTtlMs: 100 });
    const { access_token } = await current.authorize();
    await current.request(
      '/calendar/v3/calendars/primary/events/watch',
      'POST',
      {
        id: 'short',
        type: 'web_hook',
        address: 'http://127.0.0.1:5555/hook',
        expiration: String(now + 500),
      },
      access_token,
    );
    current.app.close();
    now += 1000;
    current = open(database, { now: () => now });
    expect(current.app.workspace.channels.size).toBe(0);
    expect(
      (
        await current.request(
          '/calendar/v3/users/me/calendarList',
          'GET',
          undefined,
          access_token,
        )
      ).status,
    ).toBe(401);
  });

  test('fixture replacement persists while invalid fixtures leave saved state intact', async () => {
    const database = file();
    let current = open(database);
    const baseline = structuredClone(current.app.workspace.startup);
    await current.request('/__calendarpit/fixtures', 'POST', {
      ...defaultFixture,
      events: [],
    });
    expect(
      (
        await current.request('/__calendarpit/fixtures', 'POST', {
          users: 'invalid',
        })
      ).status,
    ).toBe(400);
    current.app.close();
    current = open(database);
    expect(current.app.workspace.data.events).toEqual([]);
    await current.request('/__calendarpit/reset', 'POST', {});
    expect(current.app.workspace.data).toEqual(baseline);
  });

  test('memory sessions are isolated and do not survive reopening', async () => {
    const first = open(':memory:');
    const second = open(':memory:');
    await first.request(eventPath, 'POST', event);
    expect(
      second.app.workspace.data.events.some((e) => e.id === event.id),
    ).toBe(false);
    first.app.close();
    expect(
      open(':memory:').app.workspace.data.events.some((e) => e.id === event.id),
    ).toBe(false);
    expect(second.app.workspace.storage).toEqual({ mode: 'memory' });
  });

  test('a file has one active owner and releases its lock on close', () => {
    const database = file();
    const first = open(database);
    expect(() => open(database)).toThrow('Database is already in use');
    first.app.close();
    expect(open(database).app.workspace.storage).toEqual({
      mode: 'sqlite',
      path: database,
    });
  });

  test('rejects newer schemas without replacing data or retaining the lock', () => {
    const database = file();
    const initial = open(database);
    initial.app.close();
    const db = new Database(database);
    db.exec('PRAGMA user_version = 99');
    db.close();
    expect(() => open(database)).toThrow('Unsupported database version');
    const repair = new Database(database);
    expect(repair.query('PRAGMA user_version').get()).toEqual({
      user_version: 99,
    });
    repair.exec('PRAGMA user_version = 1');
    repair.close();
    expect(open(database).app.workspace.data.users.length).toBe(2);
  });
});

test('corrupt snapshots fail without silently reseeding the database', () => {
  const database = file();
  open(database).app.close();
  const db = new Database(database);
  db.query('UPDATE workspace SET state = ?').run('null');
  db.close();
  expect(() => open(database)).toThrow();
  const inspect = new Database(database);
  expect(inspect.query('SELECT state FROM workspace').get()).toEqual({
    state: 'null',
  });
  inspect.close();
});

test('closed instances reject writes and cannot affect a reopened workspace', async () => {
  const database = file();
  const old = open(database);
  old.app.close();
  const current = open(database);
  expect((await old.request(eventPath, 'POST', event)).status).toBe(503);
  expect(
    current.app.workspace.data.events.some((row) => row.id === event.id),
  ).toBe(false);
});

test('restart drops one-use consent, authorization codes and pagination cursors', async () => {
  const database = file();
  const first = open(database);
  const { access_token } = await first.authorize();
  const consentPage = await first.request(
    '/oauth/authorize?' +
      new URLSearchParams({
        client_id: 'sample-app',
        redirect_uri: 'http://127.0.0.1:4175/callback',
        response_type: 'code',
        scope: 'https://www.googleapis.com/auth/calendar',
      }),
  );
  expect(consentPage.status).toBe(200);
  const nonce = /name="consent" value="([^"]+)"/.exec(
    await consentPage.text(),
  )![1]!;
  const approved = await first.form('/oauth/authorize', {
    consent: nonce,
    user_id: 'alex',
    decision: 'approve',
  });
  const code = new URL(approved.headers.get('location')!).searchParams.get(
    'code',
  )!;
  const list = await first.request(
    '/calendar/v3/users/me/calendarList?maxResults=1',
    'GET',
    undefined,
    access_token,
  );
  const cursor = (await list.json()).nextPageToken;
  expect(cursor).toBeString();
  first.app.close();
  const second = open(database);
  expect(second.app.workspace.codes.size).toBe(0);
  expect(second.app.workspace.consents.size).toBe(0);
  expect(
    (
      await second.form('/oauth/token', {
        grant_type: 'authorization_code',
        client_id: 'sample-app',
        client_secret: 'local-sample-secret',
        redirect_uri: 'http://127.0.0.1:4175/callback',
        code,
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await second.request(
        '/calendar/v3/users/me/calendarList?' +
          new URLSearchParams({ maxResults: '1', pageToken: cursor }),
        'GET',
        undefined,
        access_token,
      )
    ).status,
  ).toBe(410);
});

test('calendar-list settings and watches survive restart and reset clears them', async () => {
  const database = file();
  const messages: string[] = [];
  const deliver: WorkspaceOptions['deliver'] = async (_url, init) => {
    messages.push(new Headers(init.headers).get('X-Goog-Resource-State')!);
    return new Response(null, { status: 204 });
  };
  let current = open(database, { deliver });
  const { access_token } = await current.authorize();
  const patched = await current.request(
    '/calendar/v3/users/me/calendarList/alex-personal',
    'PATCH',
    { summaryOverride: 'Home', colorId: '14' },
    access_token,
  );
  expect(patched.status).toBe(200);
  const before = await patched.json();
  await current.request(
    '/calendar/v3/users/me/calendarList/watch',
    'POST',
    {
      id: 'list-watch',
      type: 'web_hook',
      address: 'http://127.0.0.1:5555/hook',
    },
    access_token,
  );
  await current.app.drain();
  current.app.close();
  current = open(database, { deliver });
  const again = await current.request(
    '/calendar/v3/users/me/calendarList/alex-personal',
    'GET',
    undefined,
    access_token,
  );
  expect(await again.json()).toEqual(before);
  await current.request('/__calendarpit/calendars/alex-personal', 'PATCH', {
    summary: 'Renamed',
  });
  await current.app.drain();
  expect(messages).toEqual(['sync', 'exists']);
  await current.request('/__calendarpit/reset', 'POST', {});
  current.app.close();
  current = open(database);
  expect(current.app.workspace.calendarListEntries).toEqual([]);
  expect(current.app.workspace.channels.size).toBe(0);
});

test('the rate limit mode survives restart unless startup sets another', async () => {
  const database = file();
  const first = open(database);
  const saved = await first.request('/__calendarpit/rate-limit', 'PUT', {
    mode: 'error-test',
  });
  expect(saved.status).toBe(200);
  const { access_token } = await first.authorize();
  const list = '/calendar/v3/users/me/calendarList';
  for (let i = 0; i < 4; i++)
    expect(
      (await first.request(list, 'GET', undefined, access_token)).status,
    ).toBe(200);
  expect(
    (await first.request(list, 'GET', undefined, access_token)).status,
  ).toBe(403);
  first.app.close();

  const second = open(database, {
    fixture: { users: [], calendars: [], events: [], clients: [] },
  });
  const state = await (await second.request('/__calendarpit/state')).json();
  expect(state.rateLimitMode).toBe('error-test');
  expect(
    (await second.request(list, 'GET', undefined, access_token)).status,
  ).toBe(200);
  second.app.close();

  const third = open(database, { rateLimitMode: 'off' });
  expect(
    (await (await third.request('/__calendarpit/state')).json()).rateLimitMode,
  ).toBe('off');
  third.app.close();
});

test.each(['strict', 'prod', 'high'])(
  'an unknown saved rate limit mode %j loads as off',
  async (stored) => {
    const database = file();
    const first = open(database, { rateLimitMode: 'error-test' });
    first.app.close();

    const db = new Database(database);
    const row = db
      .query<{ state: string }, []>('SELECT state FROM workspace WHERE id = 1')
      .get()!;
    const snapshot = JSON.parse(row.state) as { rateLimitMode?: string };
    snapshot.rateLimitMode = stored;
    db.query('UPDATE workspace SET state = ? WHERE id = 1').run(
      JSON.stringify(snapshot),
    );
    db.close();

    const reopened = open(database);
    expect(
      (await (await reopened.request('/__calendarpit/state')).json())
        .rateLimitMode,
    ).toBe('off');
    const { access_token } = await reopened.authorize();
    const list = '/calendar/v3/users/me/calendarList';
    for (let i = 0; i < 5; i++)
      expect(
        (await reopened.request(list, 'GET', undefined, access_token)).status,
      ).toBe(200);
    reopened.app.close();
  },
);
