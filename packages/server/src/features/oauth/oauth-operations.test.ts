import { describe, expect, test } from 'bun:test';
import { apiError } from '../../testing/api-error';
import { testWorkspace } from '../../testing/workspace';
import type { Grant } from '../../model/oauth';
import { authenticate, revokeGrant, revokeToken } from './oauth-operations';

const calendarScope = 'https://www.googleapis.com/auth/calendar';

function withToken(expires: number, scopes = [calendarScope]) {
  const context = testWorkspace();
  const grant: Grant = {
    id: 'grant',
    userId: 'alex',
    clientId: 'sample-app',
    scopes,
    revoked: false,
    created: '',
  };
  context.workspace.grants.set(grant.id, grant);
  context.workspace.access.set('access', { grantId: grant.id, expires });
  context.workspace.refresh.set('refresh', {
    grantId: grant.id,
    expires: Infinity,
  });
  return { ...context, grant };
}

describe('authenticate', () => {
  test('accepts a live bearer token case-insensitively', () => {
    const { workspace, clock, grant } = withToken(Infinity);
    clock.now += 1;
    expect(authenticate(workspace, 'bearer access')).toBe(grant);
  });

  test('rejects a token at its expiry instant', () => {
    const { workspace, clock } = withToken(2000);
    clock.now = 2000;
    const error = apiError(() => authenticate(workspace, 'Bearer access'));
    expect([error.status, error.reason]).toEqual([401, 'authError']);
  });

  test.each([null, 'Basic abc', 'Bearer unknown'])(
    'rejects the header %p',
    (header) => {
      const { workspace } = withToken(Infinity);
      expect(apiError(() => authenticate(workspace, header)).status).toBe(401);
    },
  );

  test('requires one of the listed scopes', () => {
    const { workspace } = withToken(Infinity, ['openid']);
    const error = apiError(() =>
      authenticate(workspace, 'Bearer access', [calendarScope]),
    );
    expect([error.status, error.reason]).toEqual([
      403,
      'insufficientPermissions',
    ]);
  });
});

test('revoking a refresh token revokes the whole grant', () => {
  const { workspace, grant } = withToken(Infinity);
  revokeToken(workspace, 'refresh');
  expect(grant.revoked).toBe(true);
  expect(workspace.access.size + workspace.refresh.size).toBe(0);
});

test('revoking an unknown grant is not found', () => {
  const { workspace } = testWorkspace();
  expect(apiError(() => revokeGrant(workspace, 'missing')).status).toBe(404);
});
