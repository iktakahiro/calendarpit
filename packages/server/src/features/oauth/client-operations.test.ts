import { expect, test } from 'bun:test';
import { apiError } from '../../testing/api-error';
import { testWorkspace } from '../../testing/workspace';
import type { Grant } from '../../model/oauth';
import {
  createClient,
  deleteClient,
  findClient,
  updateClient,
} from './client-operations';

const callback = 'http://127.0.0.1:4175/callback';

function grantFor(clientId: string): Grant {
  return {
    id: `grant-${clientId}`,
    userId: 'alex',
    clientId,
    scopes: [],
    revoked: false,
    created: '',
  };
}

test('createClient rejects duplicate IDs and invalid redirect URIs', () => {
  const { workspace } = testWorkspace();
  expect(
    apiError(() =>
      createClient(workspace, {
        id: 'sample-app',
        secret: 's',
        redirectUris: [callback],
      }),
    ).status,
  ).toBe(409);
  expect(() =>
    createClient(workspace, {
      id: 'other',
      secret: 's',
      redirectUris: ['http://127.0.0.1/#fragment'],
    }),
  ).toThrow('Invalid redirect URI.');
  expect(workspace.data.clients.map((c) => c.id)).toEqual(['sample-app']);
});

test('updateClient keeps the ID and an omitted secret', () => {
  const { workspace } = testWorkspace();
  const client = findClient(workspace, 'sample-app');
  const updated = updateClient(workspace, client, {
    redirectUris: ['http://127.0.0.1:3000/callback'],
  });
  expect(updated.secret).toBe('local-sample-secret');
  expect(client.redirectUris).toEqual(['http://127.0.0.1:3000/callback']);
  expect(() => updateClient(workspace, client, { id: 'renamed' })).toThrow(
    'Client IDs are immutable.',
  );
});

test('updateClient keeps connections but discards codes and consents for removed redirect URIs', () => {
  const { workspace, clock } = testWorkspace();
  const grant = grantFor('sample-app');
  workspace.grants.set(grant.id, grant);
  workspace.access.set('access', { grantId: grant.id, expires: Infinity });
  workspace.codes.set('code', {
    grantId: grant.id,
    redirectUri: callback,
    expires: clock.now + 60000,
    offline: false,
  });
  workspace.consents.set('nonce', {
    clientId: 'sample-app',
    redirectUri: callback,
    scope: [],
    offline: false,
    expires: clock.now + 60000,
  });
  updateClient(workspace, findClient(workspace, 'sample-app'), {
    secret: 'rotated',
    redirectUris: ['http://127.0.0.1:3000/callback'],
  });
  expect(grant.revoked).toBe(false);
  expect(workspace.access.has('access')).toBe(true);
  expect(workspace.codes.size).toBe(0);
  expect(workspace.consents.size).toBe(0);
});

test('deleteClient revokes its connections only', () => {
  const { workspace } = testWorkspace();
  createClient(workspace, {
    id: 'other',
    secret: 's',
    redirectUris: [callback],
  });
  const sample = grantFor('sample-app');
  const other = grantFor('other');
  for (const g of [sample, other]) {
    workspace.grants.set(g.id, g);
    workspace.access.set(g.id, { grantId: g.id, expires: Infinity });
  }
  deleteClient(workspace, findClient(workspace, 'sample-app'));
  expect(workspace.data.clients.map((c) => c.id)).toEqual(['other']);
  expect(sample.revoked).toBe(true);
  expect(other.revoked).toBe(false);
  expect([...workspace.access.keys()]).toEqual([other.id]);
  expect(workspace.data.events.length).toBeGreaterThan(0);
});
