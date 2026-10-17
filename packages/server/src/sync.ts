import { fail, interval, type CalendarEvent, type Calendar } from './model';
import { expandEvents } from './recurrence';
import type { Store } from './store';

export type SyncState = {
  calendarId: string;
  userId: string;
  singleEvents: boolean;
  timeZone: string;
  min?: number;
  max?: number;
  events: CalendarEvent[];
  expires: number;
};
export type EventPage = {
  key: string;
  rows: CalendarEvent[];
  offset: number;
  syncToken?: string;
  expires: number;
};
export function booleanQuery(url: URL, key: string, fallback = false) {
  const value = url.searchParams.get(key);
  if (value === null) return fallback;
  if (value !== 'true' && value !== 'false') fail(`Invalid ${key}.`);
  return value === 'true';
}
export function readSync(
  store: Store,
  token: string,
  calendar: Calendar,
  userId: string,
  singleEvents: boolean,
  timeZone: string,
): SyncState {
  const state = store.syncTokens.get(token);
  if (
    !state ||
    state.expires <= store.now() ||
    state.calendarId !== calendar.id ||
    state.userId !== userId
  )
    fail(
      'Sync token is invalid or expired. Perform a full synchronization.',
      410,
      'fullSyncRequired',
    );
  if (state.singleEvents !== singleEvents || state.timeZone !== timeZone)
    fail('Sync query options must match the initial synchronization.');
  return state;
}
export function issueSync(
  store: Store,
  state: Omit<SyncState, 'events' | 'expires'>,
) {
  const token = crypto.randomUUID();
  for (const [key, value] of store.syncTokens)
    if (value.expires <= store.now()) store.syncTokens.delete(key);
  while (store.syncTokens.size >= 100)
    store.syncTokens.delete(store.syncTokens.keys().next().value!);
  store.syncTokens.set(token, {
    ...state,
    events: structuredClone(
      store.data.events.filter((e) => e.calendarId === state.calendarId),
    ),
    expires: store.now() + 7 * 86400000,
  });
  return token;
}
export function delta(
  state: SyncState,
  current: CalendarEvent[],
  calendar: Calendar,
): CalendarEvent[] {
  const previous = new Map(state.events.map((e) => [e.id, e]));
  const changed = current.filter((e) => previous.get(e.id)?.etag !== e.etag);
  if (!state.singleEvents) return changed;
  // Compare expanded snapshots as well: trimming a rule must cancel old instances.
  const min = state.min ?? -Infinity,
    max = state.max ?? Infinity;
  const oldExpanded = expandEvents(state.events, calendar, min, max);
  const newExpanded = expandEvents(current, calendar, min, max);
  const oldMap = new Map(oldExpanded.map((e) => [e.id, e]));
  const newMap = new Map(newExpanded.map((e) => [e.id, e]));
  const result = new Map<string, CalendarEvent>();
  for (const e of newExpanded)
    if (oldMap.get(e.id)?.etag !== e.etag) result.set(e.id, e);
  for (const e of oldExpanded)
    if (!newMap.has(e.id)) result.set(e.id, { ...e, status: 'cancelled' });
  // Single events are not limited to the initial full-sync time window.
  for (const e of changed)
    if (!e.recurrence && !e.recurringEventId) result.set(e.id, e);
  return [...result.values()];
}
export function eventPage(
  store: Store,
  url: URL,
  userId: string,
  rows: CalendarEvent[],
  syncToken?: string,
) {
  const raw = url.searchParams.get('maxResults') ?? '250';
  if (!/^\d+$/.test(raw) || +raw < 1 || +raw > 2500)
    fail('maxResults must be between 1 and 2500.');
  const keyUrl = new URL(url);
  keyUrl.searchParams.delete('pageToken');
  keyUrl.searchParams.set('_user', userId);
  keyUrl.searchParams.sort();
  const key = keyUrl.pathname + keyUrl.search;
  const pageToken = url.searchParams.get('pageToken');
  let offset = 0;
  if (pageToken) {
    const page = store.eventPages.get(pageToken);
    if (!page || page.key !== key || page.expires <= store.now())
      fail('Invalid or expired page token.', 410, 'invalidPageToken');
    rows = page.rows;
    offset = page.offset;
    syncToken = page.syncToken;
  }
  let nextPageToken: string | undefined;
  if (offset + +raw < rows.length) {
    nextPageToken = crypto.randomUUID();
    while (store.eventPages.size >= 1000)
      store.eventPages.delete(store.eventPages.keys().next().value!);
    store.eventPages.set(nextPageToken, {
      key,
      rows: structuredClone(rows),
      offset: offset + +raw,
      syncToken,
      expires: store.now() + 3600000,
    });
  }
  return {
    items: rows.slice(offset, offset + +raw),
    ...(nextPageToken
      ? { nextPageToken }
      : syncToken
        ? { nextSyncToken: syncToken }
        : {}),
  };
}
export function overlaps(
  event: CalendarEvent,
  calendar: Calendar,
  min: number,
  max: number,
) {
  const [a, b] = interval(event, calendar);
  return a < max && b > min;
}
