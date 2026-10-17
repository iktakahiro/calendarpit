import { expect, test } from 'bun:test';
import { callbackUrl } from './callback-url';

test.each([
  ['http://127.0.0.1:9000/hook', 'http://127.0.0.1:9000/hook'],
  ['http://localhost:9000/hook', 'http://127.0.0.1:9000/hook'],
  ['https://[::1]/hook', 'https://[::1]/hook'],
])('accepts the loopback address %s', (address, expected) => {
  expect(callbackUrl(address).href).toBe(expected);
});

test('accepts explicitly allowed hosts only', () => {
  expect(callbackUrl('https://hooks.test/x', ['hooks.test']).hostname).toBe(
    'hooks.test',
  );
  expect(() => callbackUrl('https://hooks.test/x')).toThrow(
    'Watch host is not allowed.',
  );
});

test.each([
  'not a url',
  'ftp://127.0.0.1/hook',
  'http://user:pass@127.0.0.1/hook',
  'http://127.0.0.1/hook#fragment',
])('rejects %s', (address) => {
  expect(() => callbackUrl(address)).toThrow('Invalid watch callback URL.');
});
