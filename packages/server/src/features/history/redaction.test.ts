import { describe, expect, test } from 'bun:test';
import { redact, redactHeaders, safeUrl } from './redaction';

describe('redact', () => {
  test('replaces secret keys at any depth, case-insensitively', () => {
    expect(
      redact({
        Access_Token: 'a',
        nested: [{ refresh_token: 'r', keep: 'yes' }],
        client_secret: 's',
      }),
    ).toEqual({
      Access_Token: '[REDACTED]',
      nested: [{ refresh_token: '[REDACTED]', keep: 'yes' }],
      client_secret: '[REDACTED]',
    });
  });

  test('redacts an OAuth authorization code in a token exchange', () => {
    expect(
      redact({
        grant_type: 'authorization_code',
        code: '4/abc',
        client_secret: 's',
        code_verifier: 'v',
      }),
    ).toEqual({
      grant_type: 'authorization_code',
      code: '[REDACTED]',
      client_secret: '[REDACTED]',
      code_verifier: '[REDACTED]',
    });
  });

  test.each([['403'], [{ value: 403 }], [[403]], [true], [null]])(
    'redacts a code whose value is not a number: %p',
    (code) => {
      expect(redact({ Code: code })).toEqual({ Code: '[REDACTED]' });
    },
  );

  test('keeps the numeric code of a Google API error response', () => {
    const error = {
      error: {
        code: 403,
        message: 'Rate Limit Exceeded',
        errors: [
          {
            domain: 'usageLimits',
            reason: 'rateLimitExceeded',
            message: 'Rate Limit Exceeded',
          },
        ],
        status: 'PERMISSION_DENIED',
      },
    };
    expect(redact(error)).toEqual(error);
  });

  test('truncates long strings', () => {
    const result = redact('x'.repeat(12001)) as string;
    expect(result).toHaveLength(12000 + ' [truncated]'.length);
    expect(result.endsWith(' [truncated]')).toBe(true);
  });
});

describe('safeUrl', () => {
  test.each([
    [
      '/oauth/authorize?code=abc&scope=x',
      '/oauth/authorize?code=%5BREDACTED%5D&scope=x',
    ],
    [
      'http://user:pw@127.0.0.1/cb?state=s',
      'http://127.0.0.1/cb?state=%5BREDACTED%5D',
    ],
  ])('redacts %s', (value, expected) => {
    expect(safeUrl(value)).toBe(expected);
  });

  test('reports unparseable URLs without echoing them', () => {
    expect(safeUrl('http://[')).toBe('[invalid URL]');
  });
});

test('redactHeaders treats Location as a URL', () => {
  expect(
    redactHeaders(
      new Headers({
        Authorization: 'Bearer token',
        Location: 'http://127.0.0.1/cb?code=abc',
      }),
    ),
  ).toEqual({
    authorization: '[REDACTED]',
    location: 'http://127.0.0.1/cb?code=%5BREDACTED%5D',
  });
});
