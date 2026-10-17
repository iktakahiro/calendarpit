import { isDeepStrictEqual } from 'node:util';
import { guestPermissionDefaults } from './event-details';
import { resolveInstance } from './recurrence';
import {
  fail,
  object,
  makeEvent,
  type Calendar,
  type CalendarEvent,
} from './model';
import type { Store } from './store';

export function decorate(
  store: Store,
  event: CalendarEvent,
  calendar: Calendar,
): CalendarEvent {
  const owner = store.data.users.find((u) => u.id === calendar.userId)!;
  const identity = { email: owner.email, displayName: owner.name };
  const organizer = event.organizer ?? identity;
  const creator = event.creator ?? identity;
  return {
    ...guestPermissionDefaults,
    ...event,
    iCalUID: event.iCalUID ?? `${event.id}@calendarpit.local`,
    organizer: {
      ...organizer,
      self: organizer.email.toLowerCase() === owner.email.toLowerCase(),
    },
    creator: {
      ...creator,
      self: creator.email.toLowerCase() === owner.email.toLowerCase(),
    },
    reminders: event.reminders ?? { useDefault: true },
    ...(event.attendees
      ? {
          attendees: event.attendees.map((p) => ({
            ...p,
            self: p.email.toLowerCase() === owner.email.toLowerCase(),
            organizer: p.email.toLowerCase() === organizer.email.toLowerCase(),
          })),
        }
      : {}),
  };
}
export function prepareEvent(
  store: Store,
  calendar: Calendar,
  input: Record<string, unknown>,
  previous: CalendarEvent | undefined,
  patch: boolean,
  admin: boolean,
  conferenceVersion: string | null,
): CalendarEvent {
  const base = previous && decorate(store, previous, calendar);
  input = { ...input };
  if (input.attendeesOmitted !== undefined) {
    if (typeof input.attendeesOmitted !== 'boolean')
      fail('attendeesOmitted must be boolean.');
    if (input.attendeesOmitted) {
      if (
        !patch ||
        !base ||
        !Array.isArray(input.attendees) ||
        input.attendees.length !== 1
      )
        fail('attendeesOmitted requires a PATCH with one attendee response.');
      const response = object(input.attendees[0]);
      if (
        Object.keys(response).some(
          (key) => !['email', 'responseStatus', 'comment'].includes(key),
        )
      )
        fail('attendeesOmitted only accepts attendee responses.');
      const owner = store.data.users.find((u) => u.id === calendar.userId)!;
      if (
        typeof response.email !== 'string' ||
        response.email.toLowerCase() !== owner.email.toLowerCase() ||
        !base.attendees?.some((p) => p.self)
      )
        fail(
          'Only the calendar owner can answer their invitation.',
          403,
          'forbiddenForNonOrganizer',
        );
      input.attendees = base.attendees.map((p) =>
        p.self ? { ...p, ...response } : p,
      );
    }
    delete input.attendeesOmitted;
  }
  if (!admin) {
    for (const key of [
      'organizer',
      'creator',
      'iCalUID',
      'recurringEventId',
      'originalStartTime',
    ] as const) {
      if (
        input[key] !== undefined &&
        !isDeepStrictEqual(input[key], base?.[key])
      )
        fail(`${key} is read-only.`, 400, 'invalidParameter');
    }
    if (base?.organizer?.self === false) {
      const permitted = [
        'attendees',
        'reminders',
        'colorId',
        'transparency',
        'extendedProperties',
      ];
      if (Object.keys(input).some((key) => !permitted.includes(key)))
        fail(
          'Only the organizer can change shared event details.',
          403,
          'forbiddenForNonOrganizer',
        );
      if (!patch)
        fail(
          'Invitees must use PATCH for local changes and RSVP.',
          403,
          'forbiddenForNonOrganizer',
        );
    }
  }
  const event = decorate(
    store,
    makeEvent(input, calendar, store.now(), base, patch),
    calendar,
  );
  if (base) {
    event.iCalUID = base.iCalUID;
    event.organizer = base.organizer;
    event.creator = base.creator;
    if (base.recurringEventId) {
      event.recurringEventId = base.recurringEventId;
      event.originalStartTime = base.originalStartTime;
    }
  }
  if (
    !admin &&
    base?.organizer?.self === false &&
    input.attendees !== undefined
  ) {
    const own = event.attendees?.find((p) => p.self);
    const original = base.attendees?.find((p) => p.self);
    if (!own || !original)
      fail('RSVP requires the calendar owner in attendees.');
    const other = (e: CalendarEvent) => e.attendees?.filter((p) => !p.self);
    if (!isDeepStrictEqual(other(event), other(base)))
      fail(
        'Invitees can only change their own response.',
        403,
        'forbiddenForNonOrganizer',
      );
    const { responseStatus: _response, comment: _comment, ...ownFields } = own;
    const {
      responseStatus: _oldResponse,
      comment: _oldComment,
      ...originalFields
    } = original;
    if (!isDeepStrictEqual(ownFields, originalFields))
      fail(
        'Invitees can only change responseStatus and comment.',
        403,
        'forbiddenForNonOrganizer',
      );
    event.transparency =
      own.responseStatus === 'declined' ? 'transparent' : 'opaque';
  }
  if (
    input.conferenceData !== undefined &&
    input.conferenceData !== null &&
    !admin &&
    conferenceVersion !== '1'
  )
    fail('conferenceData requires conferenceDataVersion=1.');
  const request = event.conferenceData?.createRequest;
  if (
    request &&
    (!event.conferenceData?.entryPoints?.length ||
      request.requestId !== base?.conferenceData?.createRequest?.requestId)
  ) {
    const digest = new Bun.CryptoHasher('sha256')
      .update(request.requestId)
      .digest('hex')
      .slice(0, 12);
    const uri = `https://meet.calendarpit.invalid/${digest}`;
    event.conferenceData = {
      createRequest: { ...request, status: { statusCode: 'success' } },
      conferenceId: digest,
      conferenceSolution: {
        key: { type: 'hangoutsMeet' },
        name: 'Calendarpit local meeting',
      },
      entryPoints: [
        {
          entryPointType: 'video',
          uri,
          label: `meet.calendarpit.invalid/${digest}`,
        },
      ],
    };
    event.hangoutLink = uri;
  }
  if (input.conferenceData === null) delete event.hangoutLink;
  return event;
}
function save(store: Store, event: CalendarEvent) {
  const i = store.data.events.findIndex(
    (e) => e.id === event.id && e.calendarId === event.calendarId,
  );
  if (i < 0) store.data.events.push(event);
  else store.data.events[i] = event;
}
function commitEventState(
  store: Store,
  calendar: Calendar,
  event: CalendarEvent,
  previous: CalendarEvent | undefined,
  sendUpdates: string,
) {
  const touched = new Set([calendar.id]);
  if (event.organizer?.self !== false) {
    for (const attendee of event.attendees ?? []) {
      const user = store.data.users.find(
        (u) => u.email.toLowerCase() === attendee.email.toLowerCase(),
      );
      const target =
        user &&
        user.id !== calendar.userId &&
        store.data.calendars.find((c) => c.userId === user.id && c.primary);
      if (
        target &&
        store.data.events.some(
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
  save(store, event);
  if (previous?.recurrence) {
    for (const exception of store.data.events.filter(
      (e) => e.calendarId === calendar.id && e.recurringEventId === event.id,
    ))
      if (
        !event.recurrence ||
        event.status === 'cancelled' ||
        !resolveInstance([event], calendar, exception.id)
      )
        save(store, {
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
        !store.data.users.some(
          (u) => u.email.toLowerCase() === email.toLowerCase(),
        )),
  );
  if (selected.length) {
    store.notifications.push({
      id: crypto.randomUUID(),
      calendarId: calendar.id,
      eventId: event.id,
      method,
      recipients: selected,
      sendUpdates,
      time: event.updated,
    });
    store.notifications = store.notifications.slice(-200);
  }
  if (method === 'REPLY') {
    if (event.recurringEventId) {
      const owner = store.data.users.find(
        (u) => u.email.toLowerCase() === event.organizer!.email.toLowerCase(),
      );
      for (const target of store.data.calendars.filter(
        (c) => c.userId === owner?.id,
      )) {
        const master = store.data.events.find(
          (e) =>
            e.calendarId === target.id &&
            e.id === event.recurringEventId &&
            e.iCalUID === event.iCalUID,
        );
        if (
          master &&
          !store.data.events.some(
            (e) => e.calendarId === target.id && e.id === event.id,
          )
        ) {
          const generated = resolveInstance(
            store.data.events,
            target,
            event.id,
          );
          if (generated) save(store, generated);
        }
      }
    }
    const own = event.attendees?.find((p) => p.self);
    if (own)
      for (const copy of store.data.events.filter(
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
    for (const user of store.data.users) {
      if (user.id === calendar.userId) continue;
      const target = store.data.calendars.find(
        (c) => c.userId === user.id && c.primary,
      );
      if (!target) continue;
      const invited = event.attendees?.find(
        (p) => p.email.toLowerCase() === user.email.toLowerCase(),
      );
      const oldCopy = store.data.events.find(
        (e) =>
          e.calendarId === target.id &&
          e.iCalUID === event.iCalUID &&
          e.id === event.id,
      );
      if (!invited && !oldCopy) continue;
      // Private properties and reminders belong to a calendar copy, never to the invitation.
      const copy = decorate(
        store,
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
        target,
      );
      save(store, copy);
      if (copy.recurrence || oldCopy?.recurrence)
        for (const exception of store.data.events.filter(
          (e) => e.calendarId === target.id && e.recurringEventId === copy.id,
        ))
          if (
            !copy.recurrence ||
            copy.status === 'cancelled' ||
            !resolveInstance([copy], target, exception.id)
          )
            save(store, {
              ...exception,
              status: 'cancelled',
              updated: event.updated,
              etag: `"${crypto.randomUUID()}"`,
            });
      touched.add(target.id);
    }
  }
  store.touch();
  for (const calendarId of touched) store.notify(calendarId);
}

/** Commit linked calendar copies together before emitting watch notifications. */
export function commitEvent(
  store: Store,
  calendar: Calendar,
  event: CalendarEvent,
  previous: CalendarEvent | undefined,
  sendUpdates: string,
) {
  const oldEvents = structuredClone(store.data.events);
  const oldNotifications = structuredClone(store.notifications);
  try {
    commitEventState(store, calendar, event, previous, sendUpdates);
  } catch (error) {
    store.data.events = oldEvents;
    store.notifications = oldNotifications;
    throw error;
  }
}
