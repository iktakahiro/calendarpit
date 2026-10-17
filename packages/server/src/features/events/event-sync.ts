import type { Calendar } from '../../model/directory';
import type { CalendarEvent } from '../../model/event';
import type { SyncState } from '../../model/sync';
import { expandEvents } from './recurrence';

/**
 * Computes the events an incremental sync returns: everything whose etag
 * changed since the token's snapshot.
 *
 * With `singleEvents`, expanded occurrences are compared too, so trimming a
 * series reports the removed occurrences as cancelled. Non-recurring events
 * are reported even outside the initial sync window, as Google does.
 */
export function delta(
  state: SyncState,
  current: CalendarEvent[],
  calendar: Calendar,
): CalendarEvent[] {
  const previous = new Map(state.events.map((e) => [e.id, e]));
  const changed = current.filter((e) => previous.get(e.id)?.etag !== e.etag);
  if (!state.singleEvents) return changed;
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
  for (const e of changed)
    if (!e.recurrence && !e.recurringEventId) result.set(e.id, e);
  return [...result.values()];
}
