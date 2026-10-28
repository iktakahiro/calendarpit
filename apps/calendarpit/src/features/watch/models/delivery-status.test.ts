import { expect, test } from 'bun:test';
import { messages } from '../../../lib/messages';
import { deliveryStatusKey } from './delivery-status';

test('maps every delivery status to a message key', () => {
  expect(deliveryStatusKey('delivered')).toBe('watch.statusDelivered');
  expect(deliveryStatusKey('failed')).toBe('watch.statusFailed');
  expect(deliveryStatusKey('queued')).toBe('watch.statusQueued');
  expect(deliveryStatusKey('cancelled')).toBe('watch.statusCancelled');
});

test('returns no key for an unknown status', () => {
  expect(deliveryStatusKey('retrying')).toBeUndefined();
  expect(deliveryStatusKey('toString')).toBeUndefined();
});

test('every mapped key has an English and a Japanese label', () => {
  for (const status of ['delivered', 'failed', 'queued', 'cancelled']) {
    const key = deliveryStatusKey(status);
    expect(key).toBeDefined();
    expect(typeof messages.en[key!]).toBe('string');
    expect(typeof messages.ja[key!]).toBe('string');
  }
});
