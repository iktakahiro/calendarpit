import { expect, test } from 'bun:test';
import { messages } from '../../../lib/messages';
import { deliveryFailureKey } from './delivery-failure';

test('maps every failure reason to a message key', () => {
  expect(deliveryFailureKey('timeout')).toBe('watch.failureTimeout');
  expect(deliveryFailureKey('network')).toBe('watch.failureNetwork');
  expect(deliveryFailureKey('callbackRejected')).toBe(
    'watch.failureCallbackRejected',
  );
});

test('returns no key without a reason or for an unknown one', () => {
  expect(deliveryFailureKey(undefined)).toBeUndefined();
  expect(deliveryFailureKey('dns')).toBeUndefined();
  expect(deliveryFailureKey('toString')).toBeUndefined();
});

test('every mapped key has an English and a Japanese label', () => {
  for (const failure of ['timeout', 'network', 'callbackRejected']) {
    const key = deliveryFailureKey(failure);
    expect(key).toBeDefined();
    expect(typeof messages.en[key!]).toBe('string');
    expect(typeof messages.ja[key!]).toBe('string');
  }
});
