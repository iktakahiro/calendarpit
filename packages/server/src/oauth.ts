import { timingSafeEqual } from 'node:crypto';
import { ApiError, fail, scopes, string, type Client } from './model';
import { Store, type Grant, type Consent } from './store';

export const secret = () =>
  crypto.randomUUID().replaceAll('-', '') +
  crypto.randomUUID().replaceAll('-', '');
export function oauthError(error: string, message: string): never {
  throw new ApiError(400, error, message);
}
export function authenticate(
  store: Store,
  request: Request,
  required: string[] = [],
): Grant {
  const token = request.headers
    .get('authorization')
    ?.match(/^Bearer (\S+)$/i)?.[1];
  const saved = token ? store.access.get(token) : undefined;
  const grant = saved ? store.grants.get(saved.grantId) : undefined;
  if (!saved || saved.expires <= store.now() || !grant || grant.revoked)
    fail('Invalid or expired access token.', 401, 'authError');
  if (required.length && !required.some((s) => grant.scopes.includes(s)))
    fail('Insufficient scope.', 403, 'insufficientPermissions');
  return grant;
}
function client(
  store: Store,
  params: URLSearchParams,
  authenticated = false,
  request?: Request,
): Client {
  let clientId = params.get('client_id');
  let clientSecret = params.get('client_secret');
  const basic = request?.headers.get('authorization');
  if (basic?.startsWith('Basic ')) {
    try {
      const decoded = atob(basic.slice(6));
      const split = decoded.indexOf(':');
      clientId = decodeURIComponent(decoded.slice(0, split));
      clientSecret = decodeURIComponent(decoded.slice(split + 1));
    } catch {
      oauthError('invalid_client', 'Invalid client authentication.');
    }
  }
  const c = store.data.clients.find((c) => c.id === clientId);
  if (!c) oauthError('invalid_client', 'Unknown client.');
  if (authenticated) {
    const a = Buffer.from(clientSecret ?? '');
    const b = Buffer.from(c.secret);
    if (a.length !== b.length || !timingSafeEqual(a, b))
      oauthError('invalid_client', 'Invalid client secret.');
  }
  return c;
}
export function authorization(store: Store, params: URLSearchParams): Consent {
  const c = client(store, params);
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
    expires: store.now() + 300000,
  };
}
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );
export function consentPage(store: Store, data: Consent) {
  for (const [id, c] of store.consents)
    if (c.expires <= store.now()) store.consents.delete(id);
  if (store.consents.size >= 1000)
    fail('Too many pending consent requests.', 429, 'rateLimitExceeded');
  const nonce = secret();
  store.consents.set(nonce, data);
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Connect your calendar · Calendarpit</title><style>body{background:#f5f3ee;color:#292b27;font:16px system-ui;max-width:600px;margin:8vh auto;padding:24px}h1{font-size:36px}form{background:#fffdf8;padding:28px;border:1px solid #dfdfd6;border-radius:12px}label,select{display:block;margin:18px 0}select,button{font:inherit;padding:12px;border-radius:6px;border:1px solid #aaa}button{cursor:pointer}button[value=approve]{background:#b9502d;color:white}li{overflow-wrap:anywhere;font-size:13px;margin:8px 0}</style></head><body><p>CALENDARPIT / LOCAL AUTHORIZATION</p><h1>Connect your calendar.</h1><p><strong>${escape(data.clientId)}</strong> wants access to a test account.</p><form method="post" action="/oauth/authorize"><input type="hidden" name="consent" value="${nonce}"><label for="user">Test user</label><select id="user" name="user_id">${store.data.users.map((u) => `<option value="${escape(u.id)}">${escape(u.name)} · ${escape(u.email)}</option>`).join('')}</select><p>Requested permissions</p><ul>${data.scope.map((s) => `<li>${escape(s)}</li>`).join('')}</ul><button name="decision" value="approve" ${store.data.users.length ? '' : 'disabled'}>Approve</button> <button name="decision" value="deny">Deny</button><p>This is a local test service. No real Google account is used.</p></form></body></html>`,
    {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'Content-Security-Policy': `default-src 'none'; style-src 'unsafe-inline'; form-action 'self' ${new URL(data.redirectUri).origin}; frame-ancestors 'none'`,
        'Referrer-Policy': 'same-origin',
      },
    },
  );
}
export function decide(store: Store, params: URLSearchParams) {
  const nonce = params.get('consent') ?? '';
  const data = store.consents.get(nonce);
  if (!data || data.expires <= store.now())
    oauthError('invalid_request', 'Consent request expired or already used.');
  if (!['approve', 'deny'].includes(params.get('decision') ?? ''))
    oauthError('invalid_request', 'Choose approve or deny.');
  const target = new URL(data.redirectUri);
  if (data.state !== undefined) target.searchParams.set('state', data.state);
  if (params.get('decision') === 'deny') {
    store.consents.delete(nonce);
    target.searchParams.set('error', 'access_denied');
  } else {
    const user = store.data.users.find((u) => u.id === params.get('user_id'));
    if (!user) oauthError('invalid_request', 'Unknown user.');
    store.consents.delete(nonce);
    const grant: Grant = {
      id: secret(),
      userId: user.id,
      clientId: data.clientId,
      scopes: data.scope,
      revoked: false,
      created: new Date(store.now()).toISOString(),
    };
    store.grants.set(grant.id, grant);
    const code = secret();
    store.codes.set(code, {
      grantId: grant.id,
      redirectUri: data.redirectUri,
      expires: store.now() + 60000,
      challenge: data.challenge,
      offline: data.offline,
    });
    target.searchParams.set('code', code);
  }
  return new Response(null, {
    status: 302,
    headers: { Location: target.href, 'Cache-Control': 'no-store' },
  });
}
function issue(store: Store, grant: Grant, offline: boolean) {
  const access_token = secret();
  const ttl = store.options.accessTokenTtlMs ?? 3600000;
  store.access.set(access_token, {
    grantId: grant.id,
    expires: store.now() + ttl,
  });
  const result: Record<string, unknown> = {
    access_token,
    token_type: 'Bearer',
    expires_in: Math.floor(ttl / 1000),
    scope: grant.scopes.join(' '),
  };
  if (offline) {
    const refresh_token = secret();
    store.refresh.set(refresh_token, { grantId: grant.id, expires: Infinity });
    result.refresh_token = refresh_token;
  }
  return Response.json(result, {
    headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' },
  });
}
export async function exchange(
  store: Store,
  request: Request,
  params: URLSearchParams,
) {
  const c = client(store, params, true, request);
  if (params.get('grant_type') === 'authorization_code') {
    const code = params.get('code') ?? '';
    const saved = store.codes.get(code);
    const grant = saved && store.grants.get(saved.grantId);
    if (
      !saved ||
      saved.expires <= store.now() ||
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
    store.codes.delete(code);
    const offline = saved.offline;
    return issue(store, grant, offline);
  }
  if (params.get('grant_type') === 'refresh_token') {
    const token = store.refresh.get(params.get('refresh_token') ?? '');
    const grant = token && store.grants.get(token.grantId);
    if (!grant || grant.revoked || grant.clientId !== c.id)
      oauthError('invalid_grant', 'Invalid refresh token.');
    if (params.has('scope') && params.get('scope') !== grant.scopes.join(' '))
      oauthError('invalid_scope', 'Refresh scope changes are unsupported.');
    return issue(store, grant, false);
  }
  return oauthError('unsupported_grant_type', 'Unsupported grant type.');
}
export function revokeToken(store: Store, token: unknown) {
  const value = string(token, 'token');
  const saved = store.access.get(value) ?? store.refresh.get(value);
  if (saved) store.revoke(saved.grantId);
  return new Response(null, {
    status: 200,
    headers: { 'Cache-Control': 'no-store' },
  });
}
