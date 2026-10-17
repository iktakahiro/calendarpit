import { fail } from '../../shared/errors';
import type { Calendar, User } from '../../model/directory';
import type { CalendarEvent } from '../../model/event';
import { recordLimit, type Workspace } from '../../workspace/workspace';
import { findCalendar } from '../calendars/calendar-operations';
import { notifyCalendar } from '../watch/channel-operations';
import { decorate } from './event-presentation';
import { resolveInstance } from './recurrence';

/** Returns the owner of a calendar. Every calendar has one by invariant. */
export function calendarOwner(workspace: Workspace, calendar: Calendar): User {
  return workspace.data.users.find((u) => u.id === calendar.userId)!;
}

/**
 * Finds a stored event, or the generated occurrence for an instance ID.
 *
 * @throws {@link ApiError} 404 `notFound` when the calendar or event does not
 * exist.
 */
export function findEvent(
  workspace: Workspace,
  calendarId: string,
  eventId: string,
): CalendarEvent {
  const e =
    workspace.data.events.find(
      (e) => e.calendarId === calendarId && e.id === eventId,
    ) ??
    resolveInstance(
      workspace.data.events,
      findCalendar(workspace, calendarId),
      eventId,
    );
  if (!e) fail('Event not found.', 404, 'notFound');
  return e;
}

/** Returns the stored events of one calendar, including exceptions. */
export const calendarEvents = (workspace: Workspace, calendarId: string) =>
  workspace.data.events.filter((e) => e.calendarId === calendarId);

/** Returns the event with Google's computed fields for its calendar owner. */
export const decorateEvent = (
  workspace: Workspace,
  event: CalendarEvent,
  calendar: Calendar,
) => decorate(event, calendarOwner(workspace, calendar));

/** Inserts or replaces an event by calendar and ID. */
function save(workspace: Workspace, event: CalendarEvent) {
  const i = workspace.data.events.findIndex(
    (e) => e.id === event.id && e.calendarId === event.calendarId,
  );
  if (i < 0) workspace.data.events.push(event);
  else workspace.data.events[i] = event;
}
function commitEventState(
  workspace: Workspace,
  calendar: Calendar,
  event: CalendarEvent,
  previous: CalendarEvent | undefined,
  sendUpdates: string,
) {
  const touched = new Set([calendar.id]);
  if (event.organizer?.self !== false) {
    for (const attendee of event.attendees ?? []) {
      const user = workspace.data.users.find(
        (u) => u.email.toLowerCase() === attendee.email.toLowerCase(),
      );
      const target =
        user &&
        user.id !== calendar.userId &&
        workspace.data.calendars.find((c) => c.userId === user.id && c.primary);
      if (
        target &&
        workspace.data.events.some(
          (e) =>
            e.calendarId === target.id &&
            e.id === event.id &&
            e.iCalUID !== event.iCalUID,
        )
      )
        fail(
          'Invitation event ID conflicts with an existing local event.',
          409,
          'duplicate',
        );
    }
  }
  save(workspace, event);
  if (previous?.recurrence) {
    for (const exception of workspace.data.events.filter(
      (e) => e.calendarId === calendar.id && e.recurringEventId === event.id,
    ))
      if (
        !event.recurrence ||
        event.status === 'cancelled' ||
        !resolveInstance([event], calendar, exception.id)
      )
        save(workspace, {
          ...exception,
          status: 'cancelled',
          updated: event.updated,
          etag: `"${crypto.randomUUID()}"`,
        });
  }
  const method =
    event.organizer?.self === false
      ? 'REPLY'
      : event.status === 'cancelled'
        ? 'CANCEL'
        : 'REQUEST';
  const recipients =
    method === 'REPLY'
      ? [event.organizer!.email]
      : [
          ...new Set(
            [...(event.attendees ?? []), ...(previous?.attendees ?? [])].map(
              (p) => p.email,
            ),
          ),
        ].filter((email) => email !== event.organizer?.email);
  const selected = recipients.filter(
    (email) =>
      sendUpdates === 'all' ||
      (sendUpdates === 'externalOnly' &&
        !workspace.data.users.some(
          (u) => u.email.toLowerCase() === email.toLowerCase(),
        )),
  );
  if (selected.length) {
    workspace.notifications.push({
      id: crypto.randomUUID(),
      calendarId: calendar.id,
      eventId: event.id,
      method,
      recipients: selected,
      sendUpdates,
      time: event.updated,
    });
    workspace.notifications = workspace.notifications.slice(-recordLimit);
  }
  if (method === 'REPLY') {
    if (event.recurringEventId) {
      const owner = workspace.data.users.find(
        (u) => u.email.toLowerCase() === event.organizer!.email.toLowerCase(),
      );
      for (const target of workspace.data.calendars.filter(
        (c) => c.userId === owner?.id,
      )) {
        const master = workspace.data.events.find(
          (e) =>
            e.calendarId === target.id &&
            e.id === event.recurringEventId &&
            e.iCalUID === event.iCalUID,
        );
        if (
          master &&
          !workspace.data.events.some(
            (e) => e.calendarId === target.id && e.id === event.id,
          )
        ) {
          const generated = resolveInstance(
            workspace.data.events,
            target,
            event.id,
          );
          if (generated) save(workspace, generated);
        }
      }
    }
    const own = event.attendees?.find((p) => p.self);
    if (own)
      for (const copy of workspace.data.events.filter(
        (e) =>
          e !== event &&
          e.iCalUID === event.iCalUID &&
          e.recurringEventId === event.recurringEventId &&
          JSON.stringify(e.originalStartTime) ===
            JSON.stringify(event.originalStartTime),
      )) {
        const attendee = copy.attendees?.find(
          (p) => p.email.toLowerCase() === own.email.toLowerCase(),
        );
        if (!attendee) continue;
        attendee.responseStatus = own.responseStatus;
        attendee.comment = own.comment;
        copy.updated = event.updated;
        copy.etag = `"${crypto.randomUUID()}"`;
        touched.add(copy.calendarId);
      }
  } else {
    for (const user of workspace.data.users) {
      if (user.id === calendar.userId) continue;
      const target = workspace.data.calendars.find(
        (c) => c.userId === user.id && c.primary,
      );
      if (!target) continue;
      const invited = event.attendees?.find(
        (p) => p.email.toLowerCase() === user.email.toLowerCase(),
      );
      const oldCopy = workspace.data.events.find(
        (e) =>
          e.calendarId === target.id &&
          e.iCalUID === event.iCalUID &&
          e.id === event.id,
      );
      if (!invited && !oldCopy) continue;
      // Private properties and reminders belong to a calendar copy, never to the invitation.
      const copy = decorate(
        {
          ...structuredClone(event),
          calendarId: target.id,
          reminders: oldCopy?.reminders ?? { useDefault: true },
          extendedProperties: {
            ...(event.extendedProperties?.shared
              ? { shared: event.extendedProperties.shared }
              : {}),
            ...(oldCopy?.extendedProperties?.private
              ? { private: oldCopy.extendedProperties.private }
              : {}),
          },
          status: invited ? event.status : 'cancelled',
          transparency:
            invited?.responseStatus === 'declined'
              ? 'transparent'
              : event.transparency,
        },
        calendarOwner(workspace, target),
      );
      save(workspace, copy);
      if (copy.recurrence || oldCopy?.recurrence)
        for (const exception of workspace.data.events.filter(
          (e) => e.calendarId === target.id && e.recurringEventId === copy.id,
        ))
          if (
            !copy.recurrence ||
            copy.status === 'cancelled' ||
            !resolveInstance([copy], target, exception.id)
          )
            save(workspace, {
              ...exception,
              status: 'cancelled',
              updated: event.updated,
              etag: `"${crypto.randomUUID()}"`,
            });
      touched.add(target.id);
    }
  }
  workspace.touch();
  for (const calendarId of touched) notifyCalendar(workspace, calendarId);
}

/**
 * Stores an event and propagates it, all or nothing.
 *
 * Besides saving the event itself, a commit:
 * - cancels stored exceptions that a changed or cancelled series no longer
 *   produces,
 * - copies organizer changes into every invited local user's primary calendar
 *   (keeping each copy's private properties and reminders), and cancels the
 *   copies of removed attendees,
 * - copies an invitee's RSVP back to the organizer's and other attendees'
 *   copies,
 * - records invitation notifications according to `sendUpdates`, and
 * - notifies watch channels of every touched calendar.
 *
 * If any step throws, events and notifications are restored before the error
 * propagates, so a failed request leaves no partial copies.
 *
 * @param previous - Stored event before the change, if any.
 * @param sendUpdates - `all`, `externalOnly`, or `none`.
 * @throws {@link ApiError} 409 `duplicate` when an invitation would overwrite
 * an unrelated event with the same ID in an attendee's calendar.
 */
export function commitEvent(
  workspace: Workspace,
  calendar: Calendar,
  event: CalendarEvent,
  previous: CalendarEvent | undefined,
  sendUpdates: string,
) {
  const oldEvents = structuredClone(workspace.data.events);
  const oldNotifications = structuredClone(workspace.notifications);
  try {
    commitEventState(workspace, calendar, event, previous, sendUpdates);
  } catch (error) {
    workspace.data.events = oldEvents;
    workspace.notifications = oldNotifications;
    throw error;
  }
}
