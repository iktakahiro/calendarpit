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
      expect(
        history.some((entry: { status: number }) => entry.status === status),
      ).toBe(true);
    },
  );

  test.each(['admin_policy_enforced', 'invalid_grant'])(
    '%s on refresh',
    async (kind) => {
      const s = setup();
      const tokens = await s.token();
      const refresh = () =>
        s.form('/oauth/token', {
          grant_type: 'refresh_token',
          client_id: 'sample-app',
          client_secret: 'local-sample-secret',
          refresh_token: tokens.refresh_token,
        });
      await s.request('/__calendarpit/faults', 'PUT', {
        target: 'token',
        kind,
      });
      const response = await refresh();
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: kind,
        error_description:
          kind === 'invalid_grant'
            ? 'Token has been expired or revoked.'
            : 'The administrator has blocked access to the requested scopes.',
      });
      expect((await refresh()).status).toBe(
        kind === 'invalid_grant' ? 400 : 200,
      );
      expect(
        (await (await s.request('/__calendarpit/faults')).json()).faults,
      ).toEqual([]);
    },
  );

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
