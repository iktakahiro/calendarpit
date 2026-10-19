import { describe, expect, test } from 'bun:test';
import { setup } from '../../testing/server-harness';

const timed = {
  id: 'test-event',
  summary: 'Busy',
  start: { dateTime: '2026-10-19T10:00:00+09:00' },
  end: { dateTime: '2026-10-19T11:00:00+09:00' },
};
const path = '/calendar/v3/calendars/primary/events';

describe('OAuth', () => {
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
  test('management client CRUD keeps workspace data and hides secrets', async () => {
    const s = setup();
    const { access_token } = await s.token();
    const moved = 'http://127.0.0.1:3000/auth/google/callback';
    const updated = await s.request(
      '/__calendarpit/clients/sample-app',
      'PATCH',
      {
        redirectUris: [moved],
      },
    );
    expect(updated.status).toBe(200);
    expect(await updated.json()).toEqual({
      id: 'sample-app',
      redirectUris: [moved],
    });
    const params = new URLSearchParams({
      client_id: 'sample-app',
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/calendar',
    });
    params.set('redirect_uri', moved);
    expect((await s.request(`/oauth/authorize?${params}`)).status).toBe(200);
    params.set('redirect_uri', 'http://127.0.0.1:4175/callback');
    expect((await s.request(`/oauth/authorize?${params}`)).status).toBe(400);
    expect(
      (
        await s.request(
          '/calendar/v3/calendars/primary/events',
          'GET',
          undefined,
          access_token,
        )
      ).status,
    ).toBe(200);

    const created = await s.request('/__calendarpit/clients', 'POST', {
      id: 'my-app',
      secret: 'local-test-secret',
      redirectUris: [moved],
    });
    expect(created.status).toBe(201);
    expect(await created.json()).toEqual({
      id: 'my-app',
      redirectUris: [moved],
    });
    expect(
      (
        await s.request('/__calendarpit/clients/my-app', 'PATCH', {
          id: 'renamed',
        })
      ).status,
    ).toBe(400);
    expect(
      (await s.request('/__calendarpit/clients/my-app', 'DELETE', {})).status,
    ).toBe(204);
    expect(
      (await s.request('/__calendarpit/clients/my-app', 'DELETE', {})).status,
    ).toBe(404);
    expect(
      (await s.request('/__calendarpit/clients/sample-app', 'POST', {})).status,
    ).toBe(404);

    expect(
      (await s.request('/__calendarpit/clients/sample-app', 'DELETE', {}))
        .status,
    ).toBe(204);
    expect(
      (
        await s.request(
          '/calendar/v3/calendars/primary/events',
          'GET',
          undefined,
          access_token,
        )
      ).status,
    ).toBe(401);
  });
});
