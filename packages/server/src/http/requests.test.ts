import { describe, expect, test } from 'bun:test';
import { apiError } from '../testing/api-error';
import {
  checkQuery,
  maxBodyBytes,
  parseJsonBody,
  readBody,
  requireSameOrigin,
} from './requests';

describe('readBody', () => {
  test('reads UTF-8 text', async () => {
    expect(
      await readBody(
        new Request('http://local', { method: 'POST', body: 'é' }),
      ),
    ).toBe('é');
  });

  test('rejects a body over the limit while streaming', async () => {
    const request = new Request('http://local', {
      method: 'POST',
      body: new Blob([new Uint8Array(maxBodyBytes + 1)]).stream(),
    });
    const error = await readBody(request).catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 413, reason: 'payloadTooLarge' });
  });

  test('rejects a declared oversized body before reading', async () => {
    const request = new Request('http://local', {
      method: 'POST',
      headers: { 'content-length': String(maxBodyBytes + 1) },
      body: 'x',
    });
    await expect(readBody(request)).rejects.toMatchObject({ status: 413 });
  });
});

test.each(['not json', '[]', 'null'])('parseJsonBody rejects %p', (text) => {
  expect(apiError(() => parseJsonBody(text)).status).toBe(400);
});

describe('requireSameOrigin', () => {
  type HeaderSet = Record<string, string>;
  const request = (headers: HeaderSet) =>
    new Request('http://127.0.0.1:4173/__calendarpit/reset', { headers });
  const sameSite: HeaderSet[] = [{}, { origin: 'http://127.0.0.1:4173' }];
  const crossSite: HeaderSet[] = [
    { origin: 'https://evil.test' },
    { 'sec-fetch-site': 'cross-site' },
  ];

  test.each(sameSite)('allows %p', (headers) => {
    expect(() => requireSameOrigin(request(headers))).not.toThrow();
  });

  test.each(crossSite)('blocks %p', (headers) => {
    expect(apiError(() => requireSameOrigin(request(headers))).status).toBe(
      403,
    );
  });
});

describe('checkQuery', () => {
  const url = (query: string) => new URL(`http://local/?${query}`);

  test('allows listed and Google system parameters', () => {
    expect(() =>
      checkQuery(url('a=1&prettyPrint=false&alt=json&key=k'), ['a']),
    ).not.toThrow();
  });

  test('rejects unknown parameters as unsupported', () => {
    expect(apiError(() => checkQuery(url('b=1'), ['a'])).reason).toBe(
      'unsupportedFeature',
    );
  });

  test('accepts only JSON responses', () => {
    expect(() => checkQuery(url('alt=media'), [])).toThrow(
      'Only JSON responses are supported.',
    );
  });
});
