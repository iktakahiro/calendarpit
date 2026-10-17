import { expect, test } from 'bun:test';
import { testWorkspace } from '../../testing/workspace';
import { loadFixture, resetWorkspace } from './fixture-operations';

test('reset restores the startup data and clears runtime state', () => {
  const { workspace } = testWorkspace();
  const baseline = structuredClone(workspace.startup);
  workspace.data.events = [];
  workspace.history.push({
    id: 'h',
    time: '',
    method: 'GET',
    path: '/',
    status: 200,
    request: null,
    response: null,
    headers: {},
    responseHeaders: {},
  });
  workspace.access.set('token', { grantId: 'g', expires: Infinity });
  resetWorkspace(workspace);
  expect(workspace.data).toEqual(baseline);
  expect(workspace.history).toEqual([]);
  expect(workspace.access.size).toBe(0);
});

test('an invalid fixture changes nothing', () => {
  const { workspace } = testWorkspace();
  const before = structuredClone(workspace.data);
  expect(() => loadFixture(workspace, { users: 'nope' })).toThrow();
  expect(workspace.data).toEqual(before);
});

test('loading a fixture keeps the startup fixture as the reset target', () => {
  const { workspace } = testWorkspace();
  const baseline = structuredClone(workspace.startup);
  loadFixture(workspace, {});
  expect(workspace.data.users).toEqual([]);
  resetWorkspace(workspace);
  expect(workspace.data).toEqual(baseline);
});
