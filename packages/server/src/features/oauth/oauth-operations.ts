import { fail } from '../../shared/errors';
import { secret } from '../../shared/secrets';
import { string } from '../../shared/validation';
import type { Consent, Grant } from '../../model/oauth';
import type { Workspace } from '../../workspace/workspace';
import { stopChannel } from '../watch/channel-operations';
import { identifyClient } from './oauth-client';
import { oauthError } from './oauth-errors';

/** Authorization codes expire after one minute. */
const codeTtlMs = 60000;
/** Access tokens expire after one hour unless configured otherwise. */
const defaultAccessTokenTtlMs = 3600000;
/** At most this many consent pages may wait for a decision. */
const maxPendingConsents = 1000;

/**
 * Resolves the grant behind a `Bearer` access token and checks its scopes.
 *
 * @param authorization - The `Authorization` header, if any.
 * @param required - Any one of these scopes suffices. Empty means no check.
 * @throws {@link ApiError} 401 `authError` for a missing, expired, or revoked
 * token, or 403 `insufficientPermissions` when no required scope is granted.
 */
export function authenticate(
  workspace: Workspace,
  authorization: string | null,
  required: string[] = [],
): Grant {
  const token = authorization?.match(/^Bearer (\S+)$/i)?.[1];
  const saved = token ? workspace.access.get(token) : undefined;
  const grant = saved ? workspace.grants.get(saved.grantId) : undefined;
  if (!saved || saved.expires <= workspace.now() || !grant || grant.revoked)
    fail('Invalid or expired access token.', 401, 'authError');
  if (required.length && !required.some((s) => grant.scopes.includes(s)))
    fail('Insufficient scope.', 403, 'insufficientPermissions');
  return grant;
}

/**
 * Stores a validated consent request and returns the nonce for its form.
 * Expired requests are pruned first.
 *
 * @throws {@link ApiError} 429 `rateLimitExceeded` when too many consent
 * requests are pending.
 */
export function createConsent(workspace: Workspace, consent: Consent) {
  for (const [id, c] of workspace.consents)
    if (c.expires <= workspace.now()) workspace.consents.delete(id);
  if (workspace.consents.size >= maxPendingConsents)
    fail('Too many pending consent requests.', 429, 'rateLimitExceeded');
  const nonce = secret();
  workspace.consents.set(nonce, consent);
  return nonce;
}

/**
 * Applies the developer's decision from the consent form.
 *
 * Approval creates a grant and a single-use authorization code. Denial sends
 * `error=access_denied`. Either way the consent is consumed and the original
 * `state` is returned.
 *
 * @param params - The form fields `consent`, `decision`, and `user_id`.
 * @returns The redirect URL for the client.
 * @throws {@link ApiError} 400 `invalid_request` for an expired consent, an
 * unknown decision, or an unknown user.
 */
export function decideConsent(workspace: Workspace, params: URLSearchParams) {
  const nonce = params.get('consent') ?? '';
  const data = workspace.consents.get(nonce);
  if (!data || data.expires <= workspace.now())
    oauthError('invalid_request', 'Consent request expired or already used.');
  if (!['approve', 'deny'].includes(params.get('decision') ?? ''))
    oauthError('invalid_request', 'Choose approve or deny.');
  const target = new URL(data.redirectUri);
  if (data.state !== undefined) target.searchParams.set('state', data.state);
  if (params.get('decision') === 'deny') {
    workspace.consents.delete(nonce);
    target.searchParams.set('error', 'access_denied');
  } else {
    const user = workspace.data.users.find(
      (u) => u.id === params.get('user_id'),
    );
    if (!user) oauthError('invalid_request', 'Unknown user.');
    workspace.consents.delete(nonce);
    const grant: Grant = {
      id: secret(),
      userId: user.id,
      clientId: data.clientId,
      scopes: data.scope,
      revoked: false,
      created: new Date(workspace.now()).toISOString(),
    };
    workspace.grants.set(grant.id, grant);
    const code = secret();
    workspace.codes.set(code, {
      grantId: grant.id,
      redirectUri: data.redirectUri,
      expires: workspace.now() + codeTtlMs,
      challenge: data.challenge,
      offline: data.offline,
    });
    target.searchParams.set('code', code);
  }
  return target.href;
}

/** Issues an access token, plus a refresh token for offline access. */
function issueTokens(workspace: Workspace, grant: Grant, offline: boolean) {
  const access_token = secret();
  const ttl = workspace.options.accessTokenTtlMs ?? defaultAccessTokenTtlMs;
  workspace.access.set(access_token, {
    grantId: grant.id,
    expires: workspace.now() + ttl,
  });
  const result: Record<string, unknown> = {
    access_token,
    token_type: 'Bearer',
    expires_in: Math.floor(ttl / 1000),
    scope: grant.scopes.join(' '),
  };
  if (offline) {
    const refresh_token = secret();
    workspace.refresh.set(refresh_token, {
      grantId: grant.id,
      expires: Infinity,
    });
    result.refresh_token = refresh_token;
  }
  return result;
}

/**
 * Handles `/oauth/token` for the `authorization_code` and `refresh_token`
 * grant types. The client must authenticate with its secret, in the form or
 * with HTTP Basic.
 *
 * Codes are single-use and bound to the client and redirect URI; a PKCE
 * verifier must match the S256 challenge. Refreshing cannot change scopes.
 *
 * @param authorization - The `Authorization` header, if any.
 * @returns The token response body.
 * @throws {@link ApiError} 400 with an OAuth error code such as
 * `invalid_client`, `invalid_grant`, or `unsupported_grant_type`.
 */
export function exchangeToken(
  workspace: Workspace,
  params: URLSearchParams,
  authorization: string | null,
) {
  const c = identifyClient(workspace.data.clients, params, authorization, true);
  if (params.get('grant_type') === 'authorization_code') {
    const code = params.get('code') ?? '';
    const saved = workspace.codes.get(code);
    const grant = saved && workspace.grants.get(saved.grantId);
    if (
      !saved ||
      saved.expires <= workspace.now() ||
      !grant ||
      grant.revoked ||
      grant.clientId !== c.id ||
      saved.redirectUri !== params.get('redirect_uri')
    )
      oauthError(
        'invalid_grant',
        'Invalid, expired, or mismatched authorization code.',
      );
    if (saved.challenge) {
      const verifier = params.get('code_verifier') ?? '';
      const hash = new Bun.CryptoHasher('sha256')
        .update(verifier)
        .digest('base64url');
      if (!/^[\w.~-]{43,128}$/.test(verifier) || hash !== saved.challenge)
        oauthError('invalid_grant', 'Invalid PKCE verifier.');
    }
    workspace.codes.delete(code);
    return issueTokens(workspace, grant, saved.offline);
  }
  if (params.get('grant_type') === 'refresh_token') {
    const token = workspace.refresh.get(params.get('refresh_token') ?? '');
    const grant = token && workspace.grants.get(token.grantId);
    if (!grant || grant.revoked || grant.clientId !== c.id)
      oauthError('invalid_grant', 'Invalid refresh token.');
    if (params.has('scope') && params.get('scope') !== grant.scopes.join(' '))
      oauthError('invalid_scope', 'Refresh scope changes are unsupported.');
    return issueTokens(workspace, grant, false);
  }
  return oauthError('unsupported_grant_type', 'Unsupported grant type.');
}

/**
 * Revokes a grant: marks it revoked, deletes its tokens and codes, and stops
 * its watch channels. Used by token revocation, the admin UI, and user
 * deletion.
 *
 * @throws {@link ApiError} 404 `notFound` for an unknown grant.
 */
export function revokeGrant(workspace: Workspace, grantId: string) {
  const grant = workspace.grants.get(grantId);
  if (!grant) fail('Connection not found.', 404, 'notFound');
  grant.revoked = true;
  for (const channel of workspace.channels.values())
    if (channel.grantId === grantId) stopChannel(workspace, channel);
  for (const map of [workspace.access, workspace.refresh, workspace.codes])
    for (const [key, token] of map)
      if (token.grantId === grantId) map.delete(key);
}

/**
 * Handles `/oauth/revoke`. Revoking either token revokes the whole grant. An
 * unknown token is not an error, as RFC 7009 requires.
 *
 * @throws {@link ApiError} 400 when no token is given.
 */
export function revokeToken(workspace: Workspace, token: unknown) {
  const value = string(token, 'token');
  const saved = workspace.access.get(value) ?? workspace.refresh.get(value);
  if (saved) revokeGrant(workspace, saved.grantId);
}
