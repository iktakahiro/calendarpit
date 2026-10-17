import { expect, test } from 'bun:test';
import { apiError } from '../../testing/api-error';
import { testWorkspace } from '../../testing/workspace';
import type { Grant } from '../../model/oauth';
import {
  createUser,
  deleteUser,
  findUser,
  updateUser,
} from './user-operations';

test('createUser rejects duplicate IDs', () => {
  const { workspace } = testWorkspace();
  expect(
    apiError(() =>
      createUser(workspace, {
        id: 'alex',
        name: 'Alex',
        email: 'a@example.test',
      }),
    ).status,
  ).toBe(409);
});

test('updateUser keeps the ID immutable', () => {
  const { workspace } = testWorkspace();
  const alex = findUser(workspace, 'alex');
  expect(updateUser(workspace, alex, { name: 'Alexandra' }).name).toBe(
    'Alexandra',
  );
  expect(() => updateUser(workspace, alex, { id: 'other' })).toThrow(
    'User IDs are immutable.',
  );
});

test('deleteUser removes calendars and events and revokes grants', () => {
  const { workspace } = testWorkspace();
  const grant: Grant = {
    id: 'grant',
    userId: 'alex',
    clientId: 'sample-app',
    scopes: [],
    revoked: false,
    created: '',
  };
  workspace.grants.set(grant.id, grant);
  workspace.access.set('token', { grantId: grant.id, expires: Infinity });
  deleteUser(workspace, findUser(workspace, 'alex'));
  expect(workspace.data.users.map((u) => u.id)).toEqual(['sam']);
  expect(workspace.data.calendars.map((c) => c.id)).toEqual(['sam-work']);
  expect(workspace.data.events).toEqual([]);
  expect(grant.revoked).toBe(true);
  expect(workspace.access.size).toBe(0);
});
