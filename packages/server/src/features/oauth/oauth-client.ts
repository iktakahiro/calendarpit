import { timingSafeEqual } from 'node:crypto';
import { fail } from '../../shared/errors';
import { fields, id, object, string } from '../../shared/validation';
import type { Client } from '../../model/oauth';
import { oauthError } from './oauth-errors';

/**
 * Parses a fixture client. Redirect URIs must be absolute HTTP(S) URLs
 * without credentials or a fragment.
 *
 * @throws {@link ApiError} 400 for an invalid client.
 */
export function parseClient(value: unknown): Client {
  const c = object(value);
  fields(c, ['id', 'secret', 'redirectUris']);
  if (!Array.isArray(c.redirectUris) || !c.redirectUris.length)
    fail('redirectUris must be a nonempty array.');
  const redirectUris = c.redirectUris.map((v) => {
    const text = string(v, 'redirect URI');
    let url: URL;
    try {
      url = new URL(text);
    } catch {
      return fail('Invalid redirect URI.');
    }
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.hash ||
      url.username ||
      url.password
    )
      fail('Invalid redirect URI.');
    return text;
  });
  return { id: id(c.id), secret: string(c.secret, 'secret'), redirectUris };
}

/**
 * Identifies the client of an OAuth request from `client_id` or HTTP Basic
 * credentials, and optionally verifies its secret in constant time.
 *
 * @param authorization - The `Authorization` header, if any.
 * @param authenticated - Require a matching client secret.
 * @throws {@link ApiError} 400 `invalid_client`.
 */
export function identifyClient(
  clients: Client[],
  params: URLSearchParams,
  authorization: string | null = null,
  authenticated = false,
): Client {
  let clientId = params.get('client_id');
  let clientSecret = params.get('client_secret');
  if (authorization?.startsWith('Basic ')) {
    try {
      const decoded = atob(authorization.slice(6));
      const split = decoded.indexOf(':');
      clientId = decodeURIComponent(decoded.slice(0, split));
      clientSecret = decodeURIComponent(decoded.slice(split + 1));
    } catch {
      oauthError('invalid_client', 'Invalid client authentication.');
    }
  }
  const c = clients.find((c) => c.id === clientId);
  if (!c) oauthError('invalid_client', 'Unknown client.');
  if (authenticated) {
    const a = Buffer.from(clientSecret ?? '');
    const b = Buffer.from(c.secret);
    if (a.length !== b.length || !timingSafeEqual(a, b))
      oauthError('invalid_client', 'Invalid client secret.');
  }
  return c;
}
