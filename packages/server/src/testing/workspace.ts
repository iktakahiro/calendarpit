import { afterEach } from 'bun:test';
import { createCalendarpit } from '../app';
import type { Workspace, WorkspaceOptions } from '../workspace/workspace';

const opened: Workspace[] = [];

/** A fixed clock start: 2026-10-19T00:00:00Z. */
export const testEpoch = Date.parse('2026-10-19T00:00:00Z');

/**
 * Opens an in-memory workspace with the built-in fixture for operation tests.
 * It is closed automatically after the test.
 *
 * @returns The workspace and a `clock` whose `now` value tests can advance.
 */
export function testWorkspace(options: WorkspaceOptions = {}) {
  const clock = { now: testEpoch };
  const workspace = createCalendarpit({
    now: () => clock.now,
    ...options,
  }).workspace;
  opened.push(workspace);
  return { workspace, clock };
}

afterEach(() => {
  for (const workspace of opened) workspace.close();
  opened.length = 0;
});
