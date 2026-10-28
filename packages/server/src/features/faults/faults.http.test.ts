import { describe, expect, test } from 'bun:test';
import { setup } from '../../testing/server-harness';

describe('fault injection', () => {
  test.each([
    ['expired_access_token', 401, 'authError', 'Invalid Credentials', 'global'],
    ['invalid_credentials', 401, 'authError', 'Invalid Credentials', 'global'],
    ['forbidden', 403, 'forbidden', 'Forbidden', 'global'],
    [
      'insufficientPermissions',
      403,
      'insufficientPermissions',
      'Insufficient Permission',
      'global',
    ],
    [
      'rateLimitExceeded',
      429,
      'rateLimitExceeded',
      'Rate Limit Exceeded',
      'usageLimits',
    ],
    ['backendError', 500, 'backendError', 'Backend Error', 'global'],
    [
      'serviceUnavailable',
      503,
      'backendError',
      'Service Unavailable',
      'global',
    ],
  ])(
    '%s is consumed once and recorded',
    async (kind, status, reason, message, domain) => {
      const s = setup();
      const { access_token } = await s.token();
      expect(
        (
          await s.request('/__calendarpit/faults', 'PUT', {
            target: 'calendar',
            kind,
          })
        ).status,
      ).toBe(200);
      expect(
        (await s.request('/calendar/v3/users/me/calendarList')).status,
      ).toBe(401);
      const response = await s.request(
        '/calendar/v3/users/me/calendarList',
        'GET',
        undefined,
        access_token,
      );
      expect(response.status).toBe(status);
      expect(await response.json()).toEqual({
        error: { code: status, message, errors: [{ domain, reason, message }] },
      });
      if (status === 401)
        expect(response.headers.get('www-authenticate')).toBe('Bearer');
      expect(
        (
          await s.request(
            '/calendar/v3/users/me/calendarList',
            'GET',
            undefined,
            access_token,
          )
        ).status,
      ).toBe(200);
      const history = await (await s.request('/__calendarpit/history')).json();
      expect(history.at(-2)).toMatchObject({
        method: 'GET',
        path: '/calendar/v3/users/me/calendarList',
        status,
        response: { error: { code: status, errors: [{ reason, domain }] } },
      });
    },
  );

  test.each(['admin_policy_enforced', 'invalid_grant'])(
    '%s on refresh',
    async (kind) => {
      const revokes = kind === 'invalid_grant';
      const s = setup({
        deliver: async () => new Response(null, { status: 204 }),
      });
      const tokens = await s.token();
      const refresh = () =>
        s.form('/oauth/token', {
          grant_type: 'refresh_token',
          client_id: 'sample-app',
          client_secret: 'local-sample-secret',
          refresh_token: tokens.refresh_token,
        });
      const events = '/calendar/v3/calendars/primary/events';
      expect(
        (
          await s.request(
            `${events}/watch`,
            'POST',
            {
              id: 'before-fault',
              type: 'web_hook',
              address: 'http://127.0.0.1:5555',
            },
            tokens.access_token,
          )
        ).status,
      ).toBe(200);
      await s.request('/__calendarpit/faults', 'PUT', {
        target: 'token',
        kind,
      });
      const response = await refresh();
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: kind,
        error_description: revokes
          ? 'Token has been expired or revoked.'
          : 'The administrator has blocked access to the requested scopes.',
      });
      const state = await (await s.request('/__calendarpit/state')).json();
      expect(
        state.connections.map((c: { revoked: boolean }) => c.revoked),
      ).toEqual([revokes]);
      expect(state.channels).toHaveLength(revokes ? 0 : 1);
      expect(
        (await s.request(events, 'GET', undefined, tokens.access_token)).status,
      ).toBe(revokes ? 401 : 200);
      expect((await refresh()).status).toBe(revokes ? 400 : 200);
      expect(
        (await (await s.request('/__calendarpit/faults')).json()).faults,
      ).toEqual([]);
    },
  );

  test('authorization-code exchanges do not consume a token fault', async () => {
    const s = setup();
    await s.request('/__calendarpit/faults', 'PUT', {
      target: 'token',
      kind: 'invalid_grant',
    });
    await s.token();
    expect(
      (await (await s.request('/__calendarpit/faults')).json()).faults,
    ).toEqual([{ target: 'token', kind: 'invalid_grant', times: 1 }]);
  });

  test('different kinds for one target are consumed in queue order', async () => {
    const s = setup();
    const { access_token } = await s.token();
    for (const kind of ['forbidden', 'backendError', 'forbidden'])
      await s.request('/__calendarpit/faults', 'PUT', {
        target: 'calendar',
        kind,
      });
    const statuses = [];
    for (let i = 0; i < 4; i++)
      statuses.push(
        (
          await s.request(
            '/calendar/v3/users/me/calendarList',
            'GET',
            undefined,
            access_token,
          )
        ).status,
      );
    expect(statuses).toEqual([403, 500, 403, 200]);
  });

  test('requests with an expired or revoked token keep the fault queued', async () => {
    let now = 1_700_000_000_000;
    const s = setup({ now: () => now, accessTokenTtlMs: 60_000 });
    const { access_token: expired } = await s.token();
    now += 60_000;
    const { access_token: revoked } = await s.token();
    await s.form('/oauth/revoke', { token: revoked });
    const { access_token: valid } = await s.token();
    await s.request('/__calendarpit/faults', 'PUT', {
      target: 'calendar',
      kind: 'backendError',
    });
    const list = '/calendar/v3/users/me/calendarList';
    for (const token of [undefined, 'not-a-token', expired, revoked])
      expect((await s.request(list, 'GET', undefined, token)).status).toBe(401);
    expect(
      (await (await s.request('/__calendarpit/faults')).json()).faults,
    ).toEqual([{ target: 'calendar', kind: 'backendError', times: 1 }]);
    expect((await s.request(list, 'GET', undefined, valid)).status).toBe(500);
    expect((await s.request(list, 'GET', undefined, valid)).status).toBe(200);
  });

  test('faulted requests are not counted against the rate-limit window', async () => {
    const s = setup({ rateLimitMode: 'error-test' });
    const { access_token } = await s.token();
    const list = '/calendar/v3/users/me/calendarList';
    await s.request('/__calendarpit/faults', 'PUT', {
      target: 'calendar',
      kind: 'backendError',
      times: 10,
    });
    for (let i = 0; i < 10; i++)
      expect(
        (await s.request(list, 'GET', undefined, access_token)).status,
      ).toBe(500);
    for (let i = 0; i < 4; i++)
      expect(
        (await s.request(list, 'GET', undefined, access_token)).status,
      ).toBe(200);
    const limited = await s.request(list, 'GET', undefined, access_token);
    expect(limited.status).toBe(403);
    expect((await limited.json()).error.errors[0].reason).toBe(
      'userRateLimitExceeded',
    );
  });

  test('bounds times and the number of queued faults', async () => {
    const s = setup();
    const put = (body: unknown) =>
      s.request('/__calendarpit/faults', 'PUT', body);
    for (const times of [101, 1.5, -1, '2'])
      expect(
        (await put({ target: 'calendar', kind: 'backendError', times })).status,
      ).toBe(400);
    expect(
      (await put({ target: 'calendar', kind: 'backendError', times: 100 }))
        .status,
    ).toBe(200);
    for (let i = 1; i < 100; i++)
      expect(
        (await put({ target: 'token', kind: 'invalid_grant' })).status,
      ).toBe(200);
    const full = await put({ target: 'token', kind: 'invalid_grant' });
    expect(full.status).toBe(400);
    expect((await full.json()).error.message).toBe('Too many pending faults.');
    expect(
      (await (await s.request('/__calendarpit/faults')).json()).faults,
    ).toHaveLength(100);
  });

  test('counts multiple injections independently by target', async () => {
    const s = setup();
    const { access_token } = await s.token();
    await s.request('/__calendarpit/faults', 'PUT', {
      target: 'token',
      kind: 'admin_policy_enforced',
    });
    await s.request('/__calendarpit/faults', 'PUT', {
      target: 'calendar',
      kind: 'backendError',
      times: 2,
    });
    for (const status of [500, 500, 200]) {
      expect(
        (
          await s.request(
            '/calendar/v3/users/me/calendarList',
            'GET',
            undefined,
            access_token,
          )
        ).status,
      ).toBe(status);
    }
    expect(
      (await (await s.request('/__calendarpit/faults')).json()).faults,
    ).toEqual([{ target: 'token', kind: 'admin_policy_enforced', times: 1 }]);
  });

  test('validates, counts, clears on reset and fixture load', async () => {
    const s = setup();
    for (const body of [
      { target: 'calendar', kind: 'unknown' },
      { target: 'token', kind: 'invalid_grant', extra: true },
      { target: 'token', kind: 'invalid_grant', times: 0 },
    ])
      expect(
        (await s.request('/__calendarpit/faults', 'PUT', body)).status,
      ).toBe(400);
    await s.request('/__calendarpit/faults', 'PUT', {
      target: 'calendar',
      kind: 'backendError',
      times: 2,
    });
    expect(
      (await (await s.request('/__calendarpit/state')).json()).faults[0].times,
    ).toBe(2);
    await s.request('/__calendarpit/reset', 'POST', {});
    expect(
      (await (await s.request('/__calendarpit/faults')).json()).faults,
    ).toEqual([]);
    await s.request('/__calendarpit/faults', 'PUT', {
      target: 'token',
      kind: 'invalid_grant',
    });
    const fixture = s.app.workspace.startup;
    expect(
      (await s.request('/__calendarpit/fixtures', 'POST', fixture)).status,
    ).toBe(200);
    expect(
      (await (await s.request('/__calendarpit/faults')).json()).faults,
    ).toEqual([]);
    await s.request('/__calendarpit/faults', 'PUT', {
      target: 'calendar',
      kind: 'backendError',
    });
    expect(
      (await s.request('/__calendarpit/faults', 'DELETE', {}, undefined))
        .status,
    ).toBe(200);
    expect(
      (await (await s.request('/__calendarpit/faults')).json()).faults,
    ).toEqual([]);
  });
});
