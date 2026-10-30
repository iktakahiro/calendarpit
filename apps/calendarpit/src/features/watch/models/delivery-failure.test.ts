import { expect, test } from 'bun:test';
import { messages } from '../../../lib/messages';
import { deliveryDetail, deliveryFailureKey } from './delivery-failure';

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

test('a failed delivery shows its failure reason over an earlier HTTP status', () => {
  expect(
    deliveryDetail({ status: 'failed', httpStatus: 503, failure: 'network' }),
  ).toEqual({ kind: 'failure', key: 'watch.failureNetwork' });
});

test('falls back to the HTTP status without a recognized reason', () => {
  expect(deliveryDetail({ status: 'failed', httpStatus: 500 })).toEqual({
    kind: 'http',
    status: 500,
  });
  expect(
    deliveryDetail({
      status: 'failed',
      httpStatus: 500,
      failure: 'dns' as never,
    }),
  ).toEqual({ kind: 'http', status: 500 });
  expect(deliveryDetail({ status: 'delivered', httpStatus: 204 })).toEqual({
    kind: 'http',
    status: 204,
  });
});

test('shows no detail for a failure without a reason or a non-failed status', () => {
  expect(deliveryDetail({ status: 'failed' })).toBeUndefined();
  expect(
    deliveryDetail({ status: 'cancelled', failure: 'timeout' }),
  ).toBeUndefined();
});
