import type { DeliveryFailure } from '@calendarpit/server';
import type { TextKey } from '../../../lib/messages';

/** Message key for each failure reason; a new reason fails type checking. */
const deliveryFailureKeys = {
  timeout: 'watch.failureTimeout',
  network: 'watch.failureNetwork',
  callbackRejected: 'watch.failureCallbackRejected',
} as const satisfies Record<DeliveryFailure, TextKey>;

/**
 * Message key that labels a delivery failure reason, or `undefined` when there
 * is none or this build does not know it, so the badge shows only the status.
 */
export function deliveryFailureKey(failure: string | undefined) {
  return failure !== undefined && Object.hasOwn(deliveryFailureKeys, failure)
    ? deliveryFailureKeys[failure as DeliveryFailure]
    : undefined;
}
