import { fail } from '../../shared/errors';
import { instant } from '../../shared/validation';
import type { Calendar } from '../../model/directory';
import type { CalendarEvent } from '../../model/event';
import { iCalUidOf } from './event-presentation';
import { interval } from './event-time';

/** Filters of a full (non-incremental) `events.list` request. */
export type EventListFilter = {
  showDeleted: boolean;
  singleEvents: boolean;
  /** Epoch milliseconds from `updatedMin`. */
  updatedMin?: number;
  /** Raw `privateExtendedProperty` values in `name=value` form. */
  privateProperties: string[];
  /** Raw `sharedExtendedProperty` values in `name=value` form. */
  sharedProperties: string[];
  iCalUID?: string;
};

/**
 * Applies Google's `events.list` filters.
 *
 * Cancelled events are hidden unless `showDeleted` or `updatedMin` is set.
 * Without `singleEvents`, cancelled exceptions of a series stay visible so
 * clients can tell which occurrences were removed. Extended property filters
 * must all match.
 *
 * @throws {@link ApiError} 400 for a property filter without `name=value`.
 */
export function filterEvents(
  rows: CalendarEvent[],
  filter: EventListFilter,
): CalendarEvent[] {
  rows = rows.filter(
    (e) =>
      (filter.showDeleted ||
        filter.updatedMin !== undefined ||
        e.status !== 'cancelled' ||
        (!filter.singleEvents && !!e.recurringEventId)) &&
      (filter.updatedMin === undefined ||
        instant(e.updated) >= filter.updatedMin),
  );
  for (const [query, key, values] of [
    ['privateExtendedProperty', 'private', filter.privateProperties],
    ['sharedExtendedProperty', 'shared', filter.sharedProperties],
  ] as const) {
    for (const value of values) {
      const equals = value.indexOf('=');
      if (equals < 1) fail(`Invalid ${query}; expected name=value.`);
      rows = rows.filter(
        (e) =>
          e.extendedProperties?.[key]?.[value.slice(0, equals)] ===
          value.slice(equals + 1),
      );
    }
  }
  const uid = filter.iCalUID;
  if (uid) rows = rows.filter((e) => iCalUidOf(e) === uid);
  return rows;
}

/**
 * Sorts by `orderBy` (`startTime` or `updated`), breaking ties and ordering
 * unsorted lists by event ID so results are deterministic.
 */
export function sortEvents(
  rows: CalendarEvent[],
  orderBy: string | null,
  calendar: Calendar,
): CalendarEvent[] {
  return rows.sort(
    (a, b) =>
      (orderBy === 'startTime'
        ? interval(a, calendar)[0] - interval(b, calendar)[0]
        : orderBy === 'updated'
          ? instant(a.updated) - instant(b.updated)
          : 0) || a.id.localeCompare(b.id),
  );
}

/**
 * Whether an original start matches the `originalStart` query of
 * `events.instances`: an exact date, or the same instant for timed events.
 */
export function matchesOriginalStart(event: CalendarEvent, original: string) {
  return (
    event.originalStartTime?.date === original ||
    (!!event.originalStartTime?.dateTime &&
      instant(event.originalStartTime.dateTime) === instant(original))
  );
}
