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
