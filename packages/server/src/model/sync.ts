import type { CalendarEvent } from './event';

/**
 * The calendar state captured when a sync token was issued. The next request
 * with that token returns the difference from these events.
 */
export type SyncState = {
  calendarId: string;
  userId: string;
  singleEvents: boolean;
  timeZone: string;
  /** Lower bound of the initial full sync window, in epoch milliseconds. */
  min?: number;
  /** Upper bound of the initial full sync window, in epoch milliseconds. */
  max?: number;
  events: CalendarEvent[];
  /** Epoch milliseconds. */
  expires: number;
};

/** A frozen page of an event list, so later pages ignore concurrent writes. */
export type EventPage = {
  /** Normalized request URL; a page token works only with the same query. */
  key: string;
  rows: CalendarEvent[];
  offset: number;
  syncToken?: string;
  /** Epoch milliseconds. */
  expires: number;
};

/**
 * A page token for non-event lists. It is valid only while the workspace
 * revision is unchanged.
 */
export type PageCursor = { key: string; revision: string; offset: number };
