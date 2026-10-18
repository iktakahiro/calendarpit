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
  httpStatus?: number;
};
