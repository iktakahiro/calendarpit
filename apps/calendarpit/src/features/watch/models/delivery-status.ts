import type { Delivery } from '@calendarpit/server';
import type { TextKey } from '../../../lib/messages';

/** Message key for each delivery status; a new status fails type checking. */
const deliveryStatusKeys = {
  delivered: 'watch.statusDelivered',
  failed: 'watch.statusFailed',
  queued: 'watch.statusQueued',
  cancelled: 'watch.statusCancelled',
} as const satisfies Record<Delivery['status'], TextKey>;

/**
 * Message key that labels a delivery status, or `undefined` for a value this
 * build does not know so the caller can show the raw value instead.
 */
export function deliveryStatusKey(status: string) {
  return Object.hasOwn(deliveryStatusKeys, status)
    ? deliveryStatusKeys[status as Delivery['status']]
    : undefined;
}
