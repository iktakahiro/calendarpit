import { describe, expect, test } from 'bun:test';
import { apiError } from '../../testing/api-error';
import type { Client } from '../../model/oauth';
import { parseAuthorizationRequest } from './authorization-request';

const client: Client = {
  id: 'app',
  secret: 'secret',
  redirectUris: ['http://127.0.0.1:4175/callback'],
};
const valid = {
  client_id: 'app',
  redirect_uri: 'http://127.0.0.1:4175/callback',
  response_type: 'code',
  scope: 'openid https://www.googleapis.com/auth/calendar openid',
};
const parse = (params: Record<string, string>) =>
  parseAuthorizationRequest(client, new URLSearchParams(params), 1000);
const challenge = 'a'.repeat(43);

test('returns a five-minute consent with deduplicated scopes', () => {
  expect(parse({ ...valid, state: 's', access_type: 'offline' })).toEqual({
    clientId: 'app',
    redirectUri: valid.redirect_uri,
    scope: ['openid', 'https://www.googleapis.com/auth/calendar'],
    state: 's',
    challenge: undefined,
    offline: true,
    expires: 301000,
  });
});

test('accepts an S256 PKCE challenge', () => {
  expect(
    parse({
      ...valid,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    }).challenge,
  ).toBe(challenge);
});

describe('rejections', () => {
  test.each([
    ['an unknown parameter', { foo: 'bar' }, 'unsupported_feature'],
    ['silent prompts', { prompt: 'none' }, 'unsupported_feature'],
    [
      'incremental authorization',
      { include_granted_scopes: 'true' },
      'unsupported_feature',
    ],
    [
      'an unregistered redirect',
      { redirect_uri: 'http://127.0.0.1:1/x' },
      'invalid_request',
    ],
    [
      'the implicit flow',
      { response_type: 'token' },
      'unsupported_response_type',
    ],
    [
      'an unknown scope',
      { scope: 'https://www.googleapis.com/auth/drive' },
      'invalid_scope',
    ],
    ['an empty scope', { scope: ' ' }, 'invalid_scope'],
    [
      'plain PKCE',
      { code_challenge: challenge, code_challenge_method: 'plain' },
      'invalid_request',
    ],
    [
      'a PKCE method without a challenge',
      { code_challenge_method: 'S256' },
      'invalid_request',
    ],
    ['an invalid access_type', { access_type: 'forever' }, 'invalid_request'],
  ])('rejects %s', (_label, overrides, reason) => {
    expect(apiError(() => parse({ ...valid, ...overrides })).reason).toBe(
      reason,
    );
  });
});
