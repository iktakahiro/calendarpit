import { fail } from '../../shared/errors';
import type { User } from '../../model/directory';
import type { Workspace } from '../../workspace/workspace';
import { revokeGrant } from '../oauth/oauth-operations';
import { makeUser } from './user-input';

/**
 * Finds a user by ID.
 *
 * @throws {@link ApiError} 404 `notFound`.
 */
export function findUser(workspace: Workspace, userId: string): User {
  const user = workspace.data.users.find((u) => u.id === userId);
  if (!user) fail('User not found.', 404, 'notFound');
  return user;
}

/**
 * Adds a test user.
 *
 * @throws {@link ApiError} 400 for invalid input, or 409 `duplicate`.
 */
export function createUser(workspace: Workspace, input: unknown): User {
  const user = makeUser(input);
  if (workspace.data.users.some((u) => u.id === user.id))
    fail('Duplicate user ID.', 409, 'duplicate');
  workspace.data.users.push(user);
  workspace.touch();
  return user;
}

/**
 * Updates a user's name or email. The ID is immutable.
 *
 * @throws {@link ApiError} 400 for invalid input or an ID change.
 */
export function updateUser(
  workspace: Workspace,
  existing: User,
  input: Record<string, unknown>,
): User {
  if (input.id !== undefined && input.id !== existing.id)
    fail('User IDs are immutable.');
  const user = makeUser({ ...existing, ...input });
  Object.assign(existing, user);
  workspace.touch();
  return user;
}

/**
 * Deletes a user with their calendars, events, and calendar-list settings,
 * and revokes their grants (which also stops their watch channels).
 */
export function deleteUser(workspace: Workspace, existing: User) {
  for (const g of workspace.grants.values())
    if (g.userId === existing.id) revokeGrant(workspace, g.id);
  const ids = workspace.data.calendars
    .filter((c) => c.userId === existing.id)
    .map((c) => c.id);
  workspace.data.events = workspace.data.events.filter(
    (e) => !ids.includes(e.calendarId),
  );
  workspace.data.calendars = workspace.data.calendars.filter(
    (c) => c.userId !== existing.id,
  );
  workspace.calendarListEntries = workspace.calendarListEntries.filter(
    (entry) => entry.userId !== existing.id,
  );
  workspace.data.users = workspace.data.users.filter((u) => u !== existing);
  workspace.touch();
}
