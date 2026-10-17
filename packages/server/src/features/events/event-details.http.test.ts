import { describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findEvent } from './event-operations';
import { snapshot } from '../status/snapshot-operations';
import { apiClient } from '../../testing/server-harness';

const path = '/calendar/v3/calendars/primary/events';
const timed = {
  id: 'appointment',
  summary: 'Appointment',
  start: { dateTime: '2026-10-19T10:00:00+09:00', timeZone: 'Asia/Tokyo' },
  end: { dateTime: '2026-10-19T11:00:00+09:00', timeZone: 'Asia/Tokyo' },
};

describe('event details', () => {
  test('guest permissions preserve explicit booleans across reads and PATCH, and reset on PUT', async () => {
    const s = await apiClient();
    const defaults = {
      guestsCanModify: false,
      guestsCanInviteOthers: true,
      guestsCanSeeOtherGuests: true,
    };
    const permissions = {
      guestsCanModify: true,
      guestsCanInviteOthers: false,
      guestsCanSeeOtherGuests: false,
    };
    expect(await s.api(`${path}/planning`)).toMatchObject(defaults);
    expect(
      await s.api(path, 'POST', { ...timed, ...permissions }),
    ).toMatchObject(permissions);
    expect(await s.api(`${path}/appointment`)).toMatchObject(permissions);
    const initial = await s.api(`${path}?showDeleted=true`);
    expect(
      initial.items.find((event: { id: string }) => event.id === 'appointment'),
    ).toMatchObject(permissions);
    expect(
      await s.api(`${path}/appointment`, 'PATCH', { summary: 'Renamed' }),
    ).toMatchObject(permissions);
    const changed = { ...permissions, guestsCanModify: false };
    expect(
      await s.api(`${path}/appointment`, 'PATCH', { guestsCanModify: false }),
    ).toMatchObject(changed);
    const delta = await s.api(
      `${path}?showDeleted=true&syncToken=${initial.nextSyncToken}`,
    );
    expect(delta.items).toHaveLength(1);
    expect(delta.items[0]).toMatchObject(changed);
    expect(await s.api(`${path}/appointment`, 'PUT', timed)).toMatchObject(
      defaults,
    );
  });
  test('invalid guest permission values fail atomically for insert, replace and patch', async () => {
    const s = await apiClient();
    await s.api(path, 'POST', timed);
    const before = snapshot(s.app.workspace);
    for (const field of [
      'guestsCanModify',
      'guestsCanInviteOthers',
      'guestsCanSeeOtherGuests',
    ]) {
      for (const value of ['true', 'false', 0, 1, null, [], {}]) {
        for (const method of ['POST', 'PUT', 'PATCH']) {
          const response = await s.api(
            method === 'POST' ? path : `${path}/appointment`,
            method,
            method === 'PATCH'
              ? { [field]: value }
              : {
                  ...timed,
                  id: method === 'POST' ? 'invalid' : timed.id,
                  [field]: value,
                },
            400,
          );
          expect(response.error.errors[0].reason).toBe('invalidParameter');
        }
      }
    }
    expect(snapshot(s.app.workspace)).toEqual(before);
  });
  test('guest permissions propagate to invitation copies and recurring instances without granting shared-field writes', async () => {
    const s = await apiClient();
    const permissions = {
      guestsCanModify: true,
      guestsCanInviteOthers: false,
      guestsCanSeeOtherGuests: false,
    };
    await s.api(path, 'POST', {
      ...timed,
      ...permissions,
      recurrence: ['RRULE:FREQ=DAILY;COUNT=2'],
      attendees: [{ email: 'sam@example.test' }],
    });
    const sam = await s.token(undefined, 'sam');
    const invitation = await s.request(
      `${path}/appointment`,
      'GET',
      undefined,
      sam.access_token,
    );
    expect(invitation.status).toBe(200);
    expect(await invitation.json()).toMatchObject(permissions);
    const instances = await s.api(`${path}/appointment/instances`);
    expect(instances.items).toHaveLength(2);
    for (const instance of instances.items)
      expect(instance).toMatchObject(permissions);
    for (const field of Object.keys(permissions)) {
      const denied = await s.request(
        `${path}/appointment`,
        'PATCH',
        { [field]: true },
        sam.access_token,
      );
      expect(denied.status).toBe(403);
      expect((await denied.json()).error.errors[0].reason).toBe(
        'forbiddenForNonOrganizer',
      );
    }
    await s.api(`${path}/appointment`, 'PATCH', { guestsCanModify: false });
    expect(
      await (
        await s.request(
          `${path}/appointment`,
          'GET',
          undefined,
          sam.access_token,
        )
      ).json(),
    ).toMatchObject({ ...permissions, guestsCanModify: false });
  });
  test('guest permissions survive SQLite restart and older saved events receive response defaults', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'calendarpit-permissions-'));
    const database = join(dir, 'state.sqlite');
    try {
      const s = await apiClient({ database });
      const permissions = {
        guestsCanModify: true,
        guestsCanInviteOthers: false,
        guestsCanSeeOtherGuests: false,
      };
      await s.api(path, 'POST', { ...timed, ...permissions });
      // Saved workspaces from older versions have no guest permission fields.
      const legacy = findEvent(s.app.workspace, 'alex-work', 'planning');
      delete legacy.guestsCanModify;
      delete legacy.guestsCanInviteOthers;
      delete legacy.guestsCanSeeOtherGuests;
      s.app.workspace.persist();
      s.app.close();
      const next = await apiClient({ database });
      expect(await next.api(`${path}/appointment`)).toMatchObject(permissions);
      expect(await next.api(`${path}/planning`)).toMatchObject({
        guestsCanModify: false,
        guestsCanInviteOthers: true,
        guestsCanSeeOtherGuests: true,
      });
      next.app.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  test('all-day nulls, tentative, visibility, color, reminders and private property filters round-trip', async () => {
    const s = await apiClient();
    const event = await s.api(
      `${path}?sendUpdates=all&conferenceDataVersion=0`,
      'POST',
      {
        ...timed,
        start: { date: '2026-10-20', dateTime: null, timeZone: null },
        end: { date: '2026-10-21', dateTime: null, timeZone: null },
        status: 'tentative',
        visibility: 'private',
        colorId: '5',
        attendees: [
          {
            email: 'outside@example.test',
            optional: true,
            responseStatus: 'tentative',
          },
        ],
        reminders: {
          useDefault: false,
          overrides: [{ method: 'popup', minutes: 15 }],
        },
        extendedProperties: { private: { source: 'test', category: 'demo' } },
      },
    );
    expect(event.start).toEqual({ date: '2026-10-20' });
    expect(event.organizer).toMatchObject({
      email: 'alex@example.test',
      self: true,
    });
    expect(event.creator.self).toBe(true);
    expect(event.attendees[0].responseStatus).toBe('tentative');
    expect(event.reminders.overrides[0].minutes).toBe(15);
    expect(event.status).toBe('tentative');
    expect(event.visibility).toBe('private');
    expect(event.colorId).toBe('5');
    expect(
      (
        await s.api(
          `${path}?privateExtendedProperty=source=test&privateExtendedProperty=category=demo`,
        )
      ).items,
    ).toHaveLength(1);
    expect(
      (await s.api(`${path}?privateExtendedProperty=category=other`)).items,
    ).toHaveLength(0);
    const free = await s.api('/calendar/v3/freeBusy', 'POST', {
      timeMin: '2026-10-19T15:00:00Z',
      timeMax: '2026-10-20T15:00:00Z',
      items: [{ id: 'primary' }],
    });
    expect(free.calendars.primary.busy).toEqual([
      { start: '2026-10-19T15:00:00+00:00', end: '2026-10-20T15:00:00+00:00' },
    ]);
    expect(s.app.workspace.notifications[0]?.recipients).toEqual([
      'outside@example.test',
    ]);
    await s.api(`${path}/appointment`, 'PUT', timed);
    const replaced = await s.api(`${path}/appointment`);
    expect(replaced.attendees).toBeUndefined();
    expect(replaced.visibility).toBeUndefined();
  });
  test('validates metadata and write parameters before saving', async () => {
    const s = await apiClient();
    for (const body of [
      { ...timed, attendees: [{ email: 'bad', responseStatus: 'yes' }] },
      {
        ...timed,
        reminders: {
          useDefault: false,
          overrides: [{ method: 'sms', minutes: 5 }],
        },
      },
      { ...timed, visibility: 'secret' },
      { ...timed, colorId: '12' },
      { ...timed, recurrence: ['RRULE:FREQ=SECONDLY;COUNT=3'] },
      { ...timed, recurrence: ['RRULE:FREQ=DAILY;COUNT=0'] },
      { ...timed, recurrence: ['RRULE:FREQ=MONTHLY;BYMONTHDAY=0'] },
    ])
      await s.api(path, 'POST', body, 400);
    await s.api(`${path}?sendUpdates=yes`, 'POST', timed, 400);
    await s.api(`${path}?conferenceDataVersion=2`, 'POST', timed, 400);
    expect(s.app.workspace.data.events).toHaveLength(1);
  });
  test('synthetic conferences are idempotent, copyable, removable and never call Google', async () => {
    const s = await apiClient();
    const body = {
      ...timed,
      conferenceData: {
        createRequest: {
          requestId: 'meeting-request',
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    };
    await s.api(path, 'POST', body, 400);
    const first = await s.api(`${path}?conferenceDataVersion=1`, 'POST', body);
    expect(first.hangoutLink).toStartWith('https://meet.calendarpit.invalid/');
    expect(first.conferenceData.createRequest.status.statusCode).toBe(
      'success',
    );
    const again = await s.api(
      `${path}/appointment?conferenceDataVersion=1`,
      'PATCH',
      { conferenceData: body.conferenceData },
    );
    expect(again.hangoutLink).toBe(first.hangoutLink);
    const copy = await s.api(`${path}?conferenceDataVersion=1`, 'POST', {
      ...timed,
      id: 'copy',
      conferenceData: first.conferenceData,
    });
    expect(copy.conferenceData.entryPoints).toEqual(
      first.conferenceData.entryPoints,
    );
    const cleared = await s.api(
      `${path}/appointment?conferenceDataVersion=1`,
      'PATCH',
      { conferenceData: null },
    );
    expect(cleared.hangoutLink).toBeUndefined();
    expect(cleared.conferenceData).toBeUndefined();
  });
});
