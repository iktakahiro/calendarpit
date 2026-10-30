/**
 * An active push notification channel created by `events.watch` or
 * `calendarList.watch`. `controller` and `tail` exist only at runtime and are
 * not persisted.
 */
export type Channel = {
  id: string;
  grantId: string;
  /** Calendar watched by `events.watch`. Absent on a calendar-list channel. */
  calendarId?: string;
  /**
   * User whose calendar list is watched by `calendarList.watch`. Absent on an
   * event channel.
   */
  userId?: string;
  resourceId: string;
  resourceUri: string;
  /** Callback URL. Must pass the watch host allowlist. */
  address: string;
  token?: string;
  /** Epoch milliseconds. */
  expiration: number;
  /** Last sent `X-Goog-Message-Number`. */
  message: number;
  /** Aborted when the channel stops, cancelling in-flight deliveries. */
  controller: AbortController;
  /** Last queued delivery; keeps deliveries ordered per channel. */
  tail: Promise<void>;
};

/** The persisted part of a {@link Channel}. */
export type SavedChannel = Omit<Channel, 'controller' | 'tail'>;

/**
 * Why a delivery attempt got no HTTP response. Carries no error text, URL, or
 * credentials.
 */
export type DeliveryFailure =
  /** The callback did not answer within the attempt timeout. */
  | 'timeout'
  /** The connection failed, such as a refused connection or a DNS error. */
  | 'network'
  /** The callback URL no longer passes the allowed watch host list. */
  | 'callbackRejected';

/** One webhook delivery attempt record, shown in the admin UI. */
export type Delivery = {
  id: string;
  channelId: string;
  /** `sync` for the initial message, `exists` for changes. */
  state: string;
  messageNumber: number;
  time: string;
  attempts: number;
  status: 'queued' | 'delivered' | 'failed' | 'cancelled';
  /** Status of the last HTTP response, if any attempt got one. */
  httpStatus?: number;
  /**
   * Reason the last attempt got no response. Absent when that attempt got an
   * HTTP response, and on a cancelled delivery.
   */
  failure?: DeliveryFailure;
};
