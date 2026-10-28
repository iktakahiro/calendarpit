import { expect, test } from 'bun:test';
import { faultCount, faultKinds } from './faults';

test('fault kinds belong to their targets', () => {
  expect(faultKinds.token).toEqual(['admin_policy_enforced', 'invalid_grant']);
  expect(faultKinds.calendar).toContain('rateLimitExceeded');
  expect(faultKinds.calendar).not.toContain('invalid_grant');
});

test('fault counts default to one and accept only integers from 1 to 100', () => {
  for (const [input, expected] of [
    ['', 1],
    ['1', 1],
    ['100', 100],
    ['0', undefined],
    ['101', undefined],
    ['1.5', undefined],
    ['abc', undefined],
  ] as const)
    expect(faultCount(input)).toBe(expected);
});
