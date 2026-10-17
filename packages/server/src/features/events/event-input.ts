import { fail } from '../../shared/errors';
import { fields, id, object, string } from '../../shared/validation';
import type { Calendar } from '../../model/directory';
import type { CalendarEvent } from '../../model/event';
import {
  attendees,
  conference,
  guestPermissionDefaults,
  person,
  reminders,
} from './event-details';
import { eventTime, interval } from './event-time';
import { validateRecurrence } from './recurrence';

/**
 * Validates an event write and builds the stored event.
 *
 * Unknown fields are rejected. `created` is kept from `previous`, while
 * `updated` and `etag` are always regenerated. `sequence` may be set on insert
 * and increments on every update. Extended properties in a patch are merged
 * key by key, and a `null` value deletes a key.
 *
 * @param value - Request body or fixture entry.
 * @param calendar - Calendar the event belongs to.
 * @param now - Current time in epoch milliseconds.
 * @param previous - Stored event for updates; `undefined` for inserts.
 * @param patch - Merge `value` into `previous` instead of replacing it.
 * @throws {@link ApiError} 400 for invalid or immutable fields, an end that is
 * not after the start, or unsupported recurrence.
 */
export function makeEvent(
  value: unknown,
  calendar: Calendar,
  now: number,
  previous?: CalendarEvent,
  patch = false,
): CalendarEvent {
  const input = object(value);
  fields(input, [
    'id',
    'summary',
    'description',
    'location',
    'start',
    'end',
    'transparency',
    'extendedProperties',
    'status',
    'kind',
    'etag',
    'created',
    'updated',
    'calendarId',
    'visibility',
    'colorId',
    'attendees',
    ...Object.keys(guestPermissionDefaults),
    'reminders',
    'organizer',
    'creator',
    'iCalUID',
    'sequence',
    'conferenceData',
    'hangoutLink',
    'recurrence',
    'recurringEventId',
    'originalStartTime',
  ]);
  if (previous && input.id !== undefined && input.id !== previous.id)
    fail('Event IDs are immutable.');
  if (input.calendarId !== undefined && input.calendarId !== calendar.id)
    fail('Calendar IDs are immutable.');
  const data: Record<string, unknown> =
    patch && previous ? { ...previous, ...input } : input;
  if (patch && previous && input.extendedProperties != null) {
    const incoming = object(input.extendedProperties);
    fields(incoming, ['private', 'shared']);
    const merged = structuredClone(previous.extendedProperties ?? {});
    for (const key of ['private', 'shared'] as const) {
      if (!(key in incoming)) continue;
      if (incoming[key] === null) {
        delete merged[key];
        continue;
      }
      const updates = object(incoming[key]);
      const values = { ...merged[key] };
      for (const [name, value] of Object.entries(updates)) {
        if (value === null) delete values[name];
        else if (typeof value === 'string')
          Object.defineProperty(values, name, {
            value,
            enumerable: true,
            configurable: true,
            writable: true,
          });
        else fail('Extended properties must be strings or null for deletion.');
      }
      merged[key] = values;
    }
    data.extendedProperties = merged;
  }
  const start = eventTime(data.start);
  const end = eventTime(data.end);
  if (!!start.date !== !!end.date)
    fail('Start and end must use the same time representation.');
  if (
    data.transparency !== undefined &&
    !['opaque', 'transparent'].includes(String(data.transparency))
  )
    fail('Invalid transparency.');
  if (
    data.status !== undefined &&
    !['confirmed', 'tentative', 'cancelled'].includes(String(data.status))
  )
    fail('Invalid status.');
  let extendedProperties: CalendarEvent['extendedProperties'];
  if (data.extendedProperties != null) {
    const props = object(data.extendedProperties);
    fields(props, ['private', 'shared']);
    extendedProperties = {};
    for (const key of ['private', 'shared'] as const)
      if (props[key] !== undefined) {
        const values = object(props[key]);
        if (Object.values(values).some((v) => typeof v !== 'string'))
          fail('Extended properties must be strings.');
        extendedProperties[key] = values as Record<string, string>;
      }
  }
  const event: CalendarEvent = {
    id: previous?.id ?? id(data.id),
    calendarId: calendar.id,
    kind: 'calendar#event',
    summary:
      data.summary === undefined
        ? ''
        : typeof data.summary === 'string'
          ? data.summary
          : fail('Invalid summary.'),
    start,
    end,
    transparency:
      (data.transparency as CalendarEvent['transparency']) ?? 'opaque',
    status: (data.status as CalendarEvent['status']) ?? 'confirmed',
    created: previous?.created ?? new Date(now).toISOString(),
    updated: new Date(now).toISOString(),
    etag: `"${crypto.randomUUID()}"`,
    ...(extendedProperties ? { extendedProperties } : {}),
  };
  for (const key of ['description', 'location'] as const)
    if (data[key] != null) {
      if (typeof data[key] !== 'string') fail(`Invalid ${key}.`);
      event[key] = data[key];
    }
  if (data.visibility != null) {
    if (
      !['default', 'public', 'private', 'confidential'].includes(
        String(data.visibility),
      )
    )
      fail('Invalid visibility.');
    event.visibility = data.visibility as CalendarEvent['visibility'];
  }
  if (data.colorId != null) {
    if (!/^(?:[1-9]|10|11)$/.test(String(data.colorId)))
      fail('Invalid event colorId.');
    event.colorId = String(data.colorId);
  }
  if (data.attendees != null) event.attendees = attendees(data.attendees);
  for (const key of Object.keys(guestPermissionDefaults) as Array<
    keyof typeof guestPermissionDefaults
  >) {
    const value = data[key];
    if (value !== undefined && typeof value !== 'boolean')
      fail(`${key} must be boolean.`);
    event[key] = value ?? guestPermissionDefaults[key];
  }
  if (data.reminders != null) event.reminders = reminders(data.reminders);
  if (data.organizer != null) event.organizer = person(data.organizer);
  if (data.creator != null) event.creator = person(data.creator);
  if (data.conferenceData != null)
    event.conferenceData = conference(data.conferenceData);
  for (const key of ['iCalUID', 'hangoutLink', 'recurringEventId'] as const)
    if (data[key] != null) event[key] = string(data[key], key);
  if (data.originalStartTime != null)
    event.originalStartTime = eventTime(data.originalStartTime);
  if (Boolean(event.recurringEventId) !== Boolean(event.originalStartTime))
    fail('Instances require recurringEventId and originalStartTime.');
  if (
    data.sequence !== undefined &&
    (!Number.isInteger(data.sequence) || Number(data.sequence) < 0)
  )
    fail('Invalid sequence.');
  event.sequence = previous
    ? (previous.sequence ?? 0) + 1
    : Number(data.sequence ?? 0);
  if (data.recurrence != null) {
    if (
      !Array.isArray(data.recurrence) ||
      data.recurrence.some((v) => typeof v !== 'string')
    )
      fail('recurrence must be an array of strings.');
    if (data.recurrence.length) {
      event.recurrence = data.recurrence as string[];
      if (event.recurringEventId)
        fail('Instances cannot contain recurrence rules.');
      validateRecurrence(event, calendar);
    }
  }
  const [a, b] = interval(event, calendar);
  if (!(b > a)) fail('End must be after start.');
  return event;
}
