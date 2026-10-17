import type { Client, Consent } from '../../model/oauth';
import { oauthError } from './oauth-errors';
import { scopes } from './scopes';

/** Consent requests expire after five minutes. */
const consentTtlMs = 300000;

/**
 * Validates a `/oauth/authorize` request for an already identified client.
 *
 * Supported: the authorization code flow, PKCE with S256, `state`,
 * `access_type`, and interactive `prompt` values. OIDC ID tokens, request
 * objects, and incremental authorization are rejected explicitly.
 *
 * @param now - Current time in epoch milliseconds.
 * @returns The consent to show, valid for five minutes.
 * @throws {@link ApiError} 400 with an OAuth error code such as
 * `invalid_request`, `invalid_scope`, or `unsupported_feature`.
 */
export function parseAuthorizationRequest(
  c: Client,
  params: URLSearchParams,
  now: number,
): Consent {
  const supported = [
    'client_id',
    'redirect_uri',
    'response_type',
    'scope',
    'state',
    'access_type',
    'prompt',
    'code_challenge',
    'code_challenge_method',
    'include_granted_scopes',
  ];
  for (const key of params.keys())
    if (!supported.includes(key))
      oauthError(
        'unsupported_feature',
        `Unsupported authorization parameter: ${key}`,
      );
  if (
    params.has('prompt') &&
    ![
      'consent',
      'select_account',
      'consent select_account',
      'select_account consent',
    ].includes(params.get('prompt')!)
  )
    oauthError('unsupported_feature', 'Only interactive consent is supported.');
  if (
    params.has('include_granted_scopes') &&
    params.get('include_granted_scopes') !== 'false'
  )
    oauthError(
      'unsupported_feature',
      'Incremental authorization is not supported.',
    );

  const redirectUri = params.get('redirect_uri');
  if (!redirectUri || !c.redirectUris.includes(redirectUri))
    oauthError('invalid_request', 'Unregistered redirect URI.');
  if (params.get('response_type') !== 'code')
    oauthError(
      'unsupported_response_type',
      'Only authorization codes are supported.',
    );
  if (params.has('nonce') || params.has('request') || params.has('request_uri'))
    oauthError(
      'unsupported_feature',
      'OIDC ID tokens and request objects are not supported.',
    );
  const scope = [
    ...new Set((params.get('scope') ?? '').split(/\s+/).filter(Boolean)),
  ];
  if (!scope.length || scope.some((s) => !scopes.includes(s)))
    oauthError('invalid_scope', 'Unsupported or missing scope.');
  const challenge = params.get('code_challenge') ?? undefined;
  if (
    challenge &&
    (params.get('code_challenge_method') !== 'S256' ||
      !/^[\w-]{43}$/.test(challenge))
  )
    oauthError('invalid_request', 'PKCE requires S256.');
  if (!challenge && params.has('code_challenge_method'))
    oauthError('invalid_request', 'Missing PKCE challenge.');
  if (
    params.has('access_type') &&
    !['online', 'offline'].includes(params.get('access_type')!)
  )
    oauthError('invalid_request', 'Invalid access_type.');
  return {
    clientId: c.id,
    redirectUri,
    scope,
    state: params.get('state') ?? undefined,
    challenge,
    offline: params.get('access_type') === 'offline',
    expires: now + consentTtlMs,
  };
}
