import { isDeepStrictEqual } from 'node:util';
import { fail } from '../../shared/errors';
import { object } from '../../shared/validation';
import type { Calendar, User } from '../../model/directory';
import type { CalendarEvent } from '../../model/event';
import { makeEvent } from './event-input';
import { decorate } from './event-presentation';

/** Context of one event insert, update, or patch. */
export type EventWrite = {
  calendar: Calendar;
  /** Owner of `calendar`. */
  owner: User;
  /** Current time in epoch milliseconds. */
  now: number;
  /** Stored event for updates; `undefined` for inserts. */
  previous?: CalendarEvent;
  /** PATCH semantics: merge the input into `previous`. */
  patch: boolean;
  /**
   * Management API writes may set fields Google treats as read-only, such as
   * `organizer`, so fixtures can model invitations.
   */
  admin: boolean;
  /** The `conferenceDataVersion` query parameter, if present. */
  conferenceDataVersion: string | null;
};

/**
 * Applies Google's write rules on top of {@link makeEvent} and returns the
 * event to commit.
 *
 * - `attendeesOmitted` lets the owner answer their own invitation with one
 *   attendee entry.
 * - Read-only fields (`organizer`, `creator`, `iCalUID`, and the instance
 *   link) cannot change through the Google API.
 * - An invitee may change only their own RSVP and personal fields, and only
 *   with PATCH. Declining makes their copy transparent.
 * - `conferenceData` needs `conferenceDataVersion=1`. A create request
 *   produces a synthetic Meet link on the reserved `.invalid` domain.
 *
 * @throws {@link ApiError} 400 for invalid input, or 403
 * `forbiddenForNonOrganizer` for changes an invitee may not make.
 */
export function prepareEvent(
  input: Record<string, unknown>,
  {
    calendar,
    owner,
    now,
    previous,
    patch,
    admin,
    conferenceDataVersion,
  }: EventWrite,
): CalendarEvent {
  const base = previous && decorate(previous, owner);
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
  const event = decorate(makeEvent(input, calendar, now, base, patch), owner);
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
    conferenceDataVersion !== '1'
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
