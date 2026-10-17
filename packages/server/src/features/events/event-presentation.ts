import { Temporal } from '@js-temporal/polyfill';
import type { User } from '../../model/directory';
import type { CalendarEvent } from '../../model/event';
import { guestPermissionDefaults } from './event-details';

const sameEmail = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** Returns the event's iCalendar UID, deriving a stable one when unset. */
export const iCalUidOf = (event: CalendarEvent) =>
  event.iCalUID ?? `${event.id}@calendarpit.local`;

/**
 * Fills the fields Google computes for the reader: guest permission defaults,
 * the iCalendar UID, organizer and creator (the calendar owner by default),
 * default reminders, and the `self`/`organizer` flags on people.
 *
 * @param owner - Owner of the calendar the event is read from. `self` is true
 * for people whose email matches the owner's.
 */
export function decorate(event: CalendarEvent, owner: User): CalendarEvent {
  const identity = { email: owner.email, displayName: owner.name };
  const organizer = event.organizer ?? identity;
  const creator = event.creator ?? identity;
  return {
    ...guestPermissionDefaults,
    ...event,
    iCalUID: iCalUidOf(event),
    organizer: {
      ...organizer,
      self: sameEmail(organizer.email, owner.email),
    },
    creator: {
      ...creator,
      self: sameEmail(creator.email, owner.email),
    },
    reminders: event.reminders ?? { useDefault: true },
    ...(event.attendees
      ? {
          attendees: event.attendees.map((p) => ({
            ...p,
            self: sameEmail(p.email, owner.email),
            organizer: sameEmail(p.email, organizer.email),
          })),
        }
      : {}),
  };
}

/**
 * Rewrites a timed event's `start` and `end` into `timeZone`, as Google does
 * for the `timeZone` query parameter. All-day events are returned unchanged.
 */
export function inTimeZone(
  event: CalendarEvent,
  timeZone: string,
): CalendarEvent {
  if (event.start.date) return event;
  const result = { ...event };
  for (const key of ['start', 'end'] as const)
    result[key] = {
      dateTime: Temporal.Instant.from(event[key].dateTime!)
        .toZonedDateTimeISO(timeZone)
        .toString({ timeZoneName: 'never' }),
      timeZone,
    };
  return result;
}

/** Removes `calendarId`, which is internal and not part of Google's `Event`. */
export function publicEvent(event: CalendarEvent) {
  const { calendarId: _calendarId, ...data } = event;
  return data;
}
