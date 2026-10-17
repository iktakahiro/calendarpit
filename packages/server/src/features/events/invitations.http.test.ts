import { describe, expect, test } from 'bun:test';
import { apiClient } from '../../testing/server-harness';

const path = '/calendar/v3/calendars/primary/events';
const timed = {
  id: 'appointment',
  summary: 'Appointment',
  start: { dateTime: '2026-10-19T10:00:00+09:00', timeZone: 'Asia/Tokyo' },
  end: { dateTime: '2026-10-19T11:00:00+09:00', timeZone: 'Asia/Tokyo' },
};

describe('invitations', () => {
  test('local invitations, RSVP propagation, cancellation and sendUpdates modes', async () => {
    const s = await apiClient();
    await s.api(`${path}?sendUpdates=externalOnly`, 'POST', {
      ...timed,
      attendees: [
        { email: 'sam@example.test' },
        { email: 'external@example.test' },
      ],
      extendedProperties: {
        private: { secret: 'owner only' },
        shared: { tag: 'shared' },
      },
    });
    expect(s.app.workspace.notifications[0]?.recipients).toEqual([
      'external@example.test',
    ]);
    const { access_token: sam } = await s.token(undefined, 'sam');
    const invitation = await (
      await s.request(`${path}/appointment`, 'GET', undefined, sam)
    ).json();
    expect(invitation.organizer.self).toBe(false);
    expect(invitation.attendees[0].self).toBe(true);
    expect(invitation.extendedProperties.private).toBeUndefined();
    expect(
      (
        await s.request(
          `${path}/appointment`,
          'PATCH',
          { summary: 'Hijack' },
          sam,
        )
      ).status,
    ).toBe(403);
    invitation.attendees[0].responseStatus = 'accepted';
    expect(
      (
        await s.request(
          `${path}/appointment?sendUpdates=all`,
          'PATCH',
          {
            attendeesOmitted: true,
            attendees: [
              { email: 'sam@example.test', responseStatus: 'accepted' },
            ],
          },
          sam,
        )
      ).status,
    ).toBe(200);
    expect(
      (await s.api(`${path}/appointment`)).attendees[0].responseStatus,
    ).toBe('accepted');
    expect(s.app.workspace.notifications[1]?.method).toBe('REPLY');
    await s.api(
      `${path}/appointment?sendUpdates=none`,
      'DELETE',
      undefined,
      204,
    );
    expect(
      (
        await (
          await s.request(`${path}/appointment`, 'GET', undefined, sam)
        ).json()
      ).status,
    ).toBe('cancelled');
    expect(s.app.workspace.notifications).toHaveLength(2);
  });
  test('instance RSVP changes the organizer occurrence and series cancellation cancels modified copies', async () => {
    const s = await apiClient();
    await s.api(path, 'POST', {
      ...timed,
      recurrence: ['RRULE:FREQ=DAILY;COUNT=2'],
      attendees: [{ email: 'sam@example.test' }],
    });
    const { access_token: sam } = await s.token(undefined, 'sam');
    const occurrence = 'appointment_20261019T010000Z';
    expect(
      (
        await s.request(
          `${path}/${occurrence}`,
          'PATCH',
          {
            attendeesOmitted: true,
            attendees: [
              { email: 'sam@example.test', responseStatus: 'declined' },
            ],
          },
          sam,
        )
      ).status,
    ).toBe(200);
    expect(
      (await s.api(`${path}/${occurrence}`)).attendees[0].responseStatus,
    ).toBe('declined');
    expect(
      (await s.api(`${path}/appointment`)).attendees[0].responseStatus,
    ).toBe('needsAction');
    await s.api(`${path}/appointment`, 'DELETE', undefined, 204);
    const result = await (
      await s.request(
        `${path}/appointment/instances?showDeleted=true`,
        'GET',
        undefined,
        sam,
      )
    ).json();
    expect(result.items).toHaveLength(2);
    expect(
      result.items.every((e: { status: string }) => e.status === 'cancelled'),
    ).toBe(true);
  });
});
