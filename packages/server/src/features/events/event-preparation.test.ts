import { describe, expect, test } from 'bun:test';
import { apiError } from '../../testing/api-error';
import { calendarIn, eventIn, owner } from '../../testing/records';
import type { CalendarEvent } from '../../model/event';
import { decorate } from './event-presentation';
import { prepareEvent, type EventWrite } from './event-preparation';

const calendar = calendarIn('UTC');
const times = {
  start: { dateTime: '2026-10-19T10:00:00Z' },
  end: { dateTime: '2026-10-19T11:00:00Z' },
};
const write = (overrides: Partial<EventWrite> = {}): EventWrite => ({
  calendar,
  owner,
  now: 0,
  patch: false,
  admin: false,
  conferenceDataVersion: null,
  ...overrides,
});

/** An invitation copy in the owner's calendar, organized by someone else. */
const invitation: CalendarEvent = decorate(
  eventIn(calendar, {
    ...times,
    organizer: { email: 'host@example.test' },
    attendees: [
      { email: 'host@example.test', responseStatus: 'accepted' },
      { email: owner.email, responseStatus: 'needsAction' },
    ],
  }),
  owner,
);

describe('read-only fields', () => {
  test.each(['organizer', 'creator', 'iCalUID'])(
    'rejects changing %s through the Google API',
    (key) => {
      const value =
        key === 'iCalUID' ? 'x@example.test' : { email: 'x@example.test' };
      expect(() => prepareEvent({ ...times, [key]: value }, write())).toThrow(
        `${key} is read-only.`,
      );
    },
  );

  test('lets the management API set the organizer', () => {
    const event = prepareEvent(
      { ...times, organizer: { email: 'host@example.test' } },
      write({ admin: true }),
    );
    expect(event.organizer).toEqual({
      email: 'host@example.test',
      self: false,
    });
  });
});

describe('invitee changes', () => {
  const asInvitee = (input: Record<string, unknown>, patch = true) =>
    prepareEvent(input, write({ previous: invitation, patch }));

  test('an RSVP decline makes the copy transparent', () => {
    const event = asInvitee({
      attendees: [
        { email: 'host@example.test', responseStatus: 'accepted' },
        { email: owner.email, responseStatus: 'declined' },
      ],
    });
    expect(event.transparency).toBe('transparent');
    expect(event.organizer?.email).toBe('host@example.test');
  });

  test('attendeesOmitted answers with only the owner entry', () => {
    const event = asInvitee({
      attendeesOmitted: true,
      attendees: [{ email: owner.email, responseStatus: 'tentative' }],
    });
    expect(event.attendees?.map((p) => p.responseStatus)).toEqual([
      'accepted',
      'tentative',
    ]);
  });

  test.each([
    ['shared details', { summary: 'Renamed' }, true],
    ['a full replacement', { reminders: { useDefault: true } }, false],
    [
      "another attendee's response",
      {
        attendees: [
          { email: 'host@example.test', responseStatus: 'declined' },
          { email: owner.email, responseStatus: 'accepted' },
        ],
      },
      true,
    ],
  ])('rejects %s', (_label, input, patch) => {
    expect(apiError(() => asInvitee(input, patch)).reason).toBe(
      'forbiddenForNonOrganizer',
    );
  });
});

describe('conference data', () => {
  const request = {
    createRequest: {
      requestId: 'request-1',
      conferenceSolutionKey: { type: 'hangoutsMeet' },
    },
  };

  test('requires conferenceDataVersion=1', () => {
    expect(() =>
      prepareEvent({ ...times, conferenceData: request }, write()),
    ).toThrow('conferenceData requires conferenceDataVersion=1.');
  });

  test('creates a deterministic local Meet link', () => {
    const create = () =>
      prepareEvent(
        { ...times, conferenceData: request },
        write({ conferenceDataVersion: '1' }),
      );
    const event = create();
    expect(event.hangoutLink).toMatch(
      /^https:\/\/meet\.calendarpit\.invalid\/[0-9a-f]{12}$/,
    );
    expect(event.conferenceData?.createRequest?.status).toEqual({
      statusCode: 'success',
    });
    expect(create().hangoutLink).toBe(event.hangoutLink);
  });
});
