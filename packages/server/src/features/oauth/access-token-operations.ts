import type { Grant } from '../../model/oauth';
import type { Workspace } from '../../workspace/workspace';

/**
 * Resolves the grant behind a still-valid `Bearer` access token.
 *
 * This is the single definition of a valid token for Calendar API requests:
 * the token must be well-formed, known, unexpired, and its grant not revoked.
 * It does not check scopes and never throws, so callers that must not react to
 * an invalid token (such as fault injection and quota accounting) can leave
 * the `401` to the route.
 *
 * @param authorization - The `Authorization` header, if any.
 * @returns The grant, or `undefined` for a missing, unknown, expired, or
 * revoked token.
 */
export function validBearerGrant(
  workspace: Workspace,
  authorization: string | null,
): Grant | undefined {
  const token = authorization?.match(/^Bearer (\S+)$/i)?.[1];
  const saved = token ? workspace.access.get(token) : undefined;
  const grant = saved ? workspace.grants.get(saved.grantId) : undefined;
  if (!saved || saved.expires <= workspace.now() || !grant || grant.revoked)
    return undefined;
  return grant;
}
