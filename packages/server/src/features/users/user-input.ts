import { fail } from '../../shared/errors';
import { fields, id, object, string } from '../../shared/validation';
import type { User } from '../../model/directory';

/**
 * Parses a test user for fixtures and the management API. A missing ID
 * becomes a UUID.
 *
 * @throws {@link ApiError} 400 for unknown fields, a blank name, or an invalid
 * email.
 */
export function makeUser(value: unknown): User {
  const d = object(value);
  fields(d, ['id', 'name', 'email']);
  const email = string(d.email, 'email');
  if (!/^[^\s@]+@[^\s@]+$/.test(email)) fail('Invalid email.');
  return { id: id(d.id), name: string(d.name, 'name'), email };
}
