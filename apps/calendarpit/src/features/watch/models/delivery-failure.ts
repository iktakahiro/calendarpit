import type { Delivery, DeliveryFailure } from '@calendarpit/server';
import type { TextKey } from '../../../lib/messages';

/** Message key for each failure reason; a new reason fails type checking. */
const deliveryFailureKeys = {
  timeout: 'watch.failureTimeout',
  network: 'watch.failureNetwork',
  callbackRejected: 'watch.failureCallbackRejected',
} as const satisfies Record<DeliveryFailure, TextKey>;

/** What the status badge shows after the status label. */
export type DeliveryDetail =
  | { kind: 'failure'; key: TextKey }
  | { kind: 'http'; status: number };

/**
 * The detail shown after a delivery's status. A failed delivery shows the
 * reason of its last attempt, which has no HTTP response, even when an earlier
 * attempt got a status; otherwise the last HTTP status is shown.
 */
export function deliveryDetail(
  delivery: Pick<Delivery, 'status' | 'httpStatus' | 'failure'>,
): DeliveryDetail | undefined {
  const key =
    delivery.status === 'failed'
      ? deliveryFailureKey(delivery.failure)
      : undefined;
  if (key) return { kind: 'failure', key };
  if (delivery.httpStatus) return { kind: 'http', status: delivery.httpStatus };
  return undefined;
}

/**
 * Message key that labels a delivery failure reason, or `undefined` when there
 * is none or this build does not know it, so the badge shows only the status.
 */
export function deliveryFailureKey(failure: string | undefined) {
  return failure !== undefined && Object.hasOwn(deliveryFailureKeys, failure)
    ? deliveryFailureKeys[failure as DeliveryFailure]
    : undefined;
}
