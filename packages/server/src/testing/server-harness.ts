import { afterEach, expect } from 'bun:test';
import { createCalendarpit, type WorkspaceOptions } from '../index';
const instances: ReturnType<typeof createCalendarpit>[] = [];

/**
 * Creates an in-memory Calendarpit for one test, closed automatically after
 * the test. The helpers send requests through `app.handle()` without a
 * network server:
 *
 * - `request(path, method, body, token, headers)` sends JSON with an optional
 *   bearer token.
 * - `form(path, data)` posts a URL-encoded form.
 * - `consent(scope, user, decision, params)` completes the consent page for
 *   the default `sample-app` client and returns the redirect URL.
 * - `token(scope, user)` runs the full authorization code flow and returns
 *   the token response.
 */
export function setup(options: WorkspaceOptions = {}) {
  const app = createCalendarpit(options);
  instances.push(app);
  const request = async (
    path: string,
    method = 'GET',
    body?: unknown,
    token?: string,
    extra: Record<string, string> = {},
  ) =>
    (await app.handle(
      new Request(`http://127.0.0.1:4173${path}`, {
        method,
        headers: {
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...extra,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    ))!;
  const form = async (path: string, data: Record<string, string>) =>
    (await app.handle(
      new Request(`http://127.0.0.1:4173${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(data),
      }),
    ))!;
  const consent = async (
    scope = 'https://www.googleapis.com/auth/calendar',
    user = 'alex',
    decision = 'approve',
    extra: Record<string, string> = {},
  ) => {
    const params = new URLSearchParams({
      client_id: 'sample-app',
      redirect_uri: 'http://127.0.0.1:4175/callback',
      response_type: 'code',
      scope,
      state: 'preserve & = state',
      access_type: 'offline',
      ...extra,
    });
    const page = await request(`/oauth/authorize?${params}`);
    expect(page.status).toBe(200);
    const nonce = /name="consent" value="([^"]+)"/.exec(await page.text())![1]!;
    const result = await form('/oauth/authorize', {
      consent: nonce,
      user_id: user,
      decision,
    });
    expect(result.status).toBe(302);
    return new URL(result.headers.get('location')!);
  };
  const token = async (scope?: string, user?: string) => {
    const redirect = await consent(scope, user);
    const response = await form('/oauth/token', {
      grant_type: 'authorization_code',
      client_id: 'sample-app',
      client_secret: 'local-sample-secret',
      redirect_uri: 'http://127.0.0.1:4175/callback',
      code: redirect.searchParams.get('code')!,
    });
    expect(response.status).toBe(200);
    return (await response.json()) as {
      access_token: string;
      refresh_token: string;
    };
  };
  return { app, request, form, consent, token };
}
afterEach(() => {
  for (const app of instances) app.close();
  instances.length = 0;
});

/**
 * Like {@link setup}, but already authorized as `alex` with full Calendar
 * scope. `api(url, method, body, status)` sends JSON with the token, asserts
 * the expected status, and returns the parsed body (or `undefined` for 204).
 */
export async function apiClient(options: WorkspaceOptions = {}) {
  const s = setup(options);
  const { access_token: t } = await s.token();
  const api = async (
    url: string,
    method = 'GET',
    body?: unknown,
    status = 200,
  ) => {
    const response = await s.request(url, method, body, t, {
      'Content-Type': 'application/json',
    });
    expect(response.status).toBe(status);
    return response.status === 204 ? undefined : response.json();
  };
  return { ...s, t, api };
}
