import { describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setup } from './testing/server-harness';
import { snapshot } from './features/status/snapshot-operations';
import { resetWorkspace } from './features/fixtures/fixture-operations';
import { findEvent } from './features/events/event-operations';

const path = '/calendar/v3/calendars/primary/events';
const timed = {
  id: 'appointment',
  summary: 'Appointment',
  start: { dateTime: '2026-10-19T10:00:00+09:00', timeZone: 'Asia/Tokyo' },
  end: { dateTime: '2026-10-19T11:00:00+09:00', timeZone: 'Asia/Tokyo' },
};
async function client(options: Parameters<typeof setup>[0] = {}) {
  const s = setup(options);
  const { access_token: t } = await s.token();
  const api = async (
    url: string,
    method = 'GET',
    body?: unknown,
    status = 200,
  ) => {
    const response = await s.request(url, method, body, t, {
      'Content-Type': 'application/json',
    });
    expect(response.status).toBe(status);
    return response.status === 204 ? undefined : response.json();
  };
  return { ...s, t, api };
}

describe('Google-compatible event details', () => {
  test('guest permissions preserve explicit booleans across reads and PATCH, and reset on PUT', async () => {
    const s = await client();
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
    const s = await client();
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
    const s = await client();
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
      const s = await client({ database });
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
      const next = await client({ database });
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
    const s = await client();
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
    const s = await client();
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
    const s = await client();
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
  test('calendar-list role filtering and deletion visibility', async () => {
    const s = await client();
    const list = '/calendar/v3/users/me/calendarList';
    expect(
      (await s.api(`${list}?minAccessRole=reader&showDeleted=false`)).items,
    ).toHaveLength(2);
    await s.api(`${list}?minAccessRole=invalid`, 'GET', undefined, 400);
    await s.api(
      '/__calendarpit/calendars/alex-personal',
      'DELETE',
      undefined,
      204,
    );
    expect((await s.api(`${list}?showDeleted=false`)).items).toHaveLength(1);
    expect(
      (await s.api(`${list}?showDeleted=true`)).items.find(
        (c: { id: string }) => c.id === 'alex-personal',
      ).deleted,
    ).toBe(true);
  });
});

describe('incremental sync', () => {
  test('frozen pagination does not lose writes; updates and tombstones are delivered once', async () => {
    const s = await client();
    await s.api(path, 'POST', timed);
    const first = await s.api(`${path}?showDeleted=true&maxResults=1`);
    expect(first.nextSyncToken).toBeUndefined();
    await s.api(`${path}/planning`, 'PATCH', { summary: 'During pagination' });
    await s.api(`${path}/appointment`, 'DELETE', undefined, 204);
    const last = await s.api(
      `${path}?showDeleted=true&maxResults=1&pageToken=${first.nextPageToken}`,
    );
    expect(last.items[0].summary).toBe('Weekly planning');
    const next = await s.api(
      `${path}?showDeleted=true&syncToken=${last.nextSyncToken}`,
    );
    expect(next.items.map((e: { id: string }) => e.id)).toEqual([
      'appointment',
      'planning',
    ]);
    expect(next.items[0].status).toBe('cancelled');
    expect(next.items[1].summary).toBe('During pagination');
    expect(
      (await s.api(`${path}?showDeleted=true&syncToken=${next.nextSyncToken}`))
        .items,
    ).toEqual([]);
    expect((await s.api(path)).items).toHaveLength(1);
    expect((await s.api(`${path}?showDeleted=true`)).items).toHaveLength(2);
  });
  test('sync scopes, incompatible parameters, expiry and reset require full sync', async () => {
    let now = Date.parse('2026-10-17T00:00:00Z');
    const s = await client({ now: () => now });
    const initial = await s.api(`${path}?singleEvents=true&showDeleted=true`);
    const query = `singleEvents=true&syncToken=${initial.nextSyncToken}`;
    for (const param of [
      'showDeleted=false',
      'timeMin=2026-10-01T00:00:00Z',
      'orderBy=startTime',
      'privateExtendedProperty=x=y',
    ])
      await s.api(`${path}?${query}&${param}`, 'GET', undefined, 400);
    await s.api(
      `${path}?syncToken=${initial.nextSyncToken}`,
      'GET',
      undefined,
      400,
    );
    await s.api(
      `/calendar/v3/calendars/alex-personal/events?${query}`,
      'GET',
      undefined,
      410,
    );
    const sam = await s.token(undefined, 'sam');
    expect(
      (await s.request(`${path}?${query}`, 'GET', undefined, sam.access_token))
        .status,
    ).toBe(410);
    now += 8 * 86400000;
    const fresh = await s.token();
    expect(
      (
        await s.request(
          `${path}?${query}`,
          'GET',
          undefined,
          fresh.access_token,
        )
      ).status,
    ).toBe(410);
    resetWorkspace(s.app.workspace);
    const after = await s.token();
    expect(
      (
        await s.request(
          `${path}?${query}`,
          'GET',
          undefined,
          after.access_token,
        )
      ).status,
    ).toBe(410);
  });
  test('watch-triggered changes and deletions persist with sync tokens through restart', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'calendarpit-sync-'));
    const database = join(dir, 'state.sqlite');
    try {
      let deliveries = 0;
      const deliver = async () => {
        deliveries++;
        return new Response(null, { status: 204 });
      };
      const s = await client({ database, deliver });
      const initial = await s.api(`${path}?showDeleted=true`);
      await s.api(`${path}/watch`, 'POST', {
        id: 'changes',
        type: 'web_hook',
        address: 'http://127.0.0.1:5555/watch',
      });
      await s.app.drain();
      await s.api(
        '/__calendarpit/calendars/alex-work/events/planning',
        'DELETE',
        undefined,
        204,
      );
      await s.app.drain();
      expect(deliveries).toBe(2);
      s.app.close();
      const restarted = setup({ database, deliver });
      const response = await restarted.request(
        `${path}?showDeleted=true&syncToken=${initial.nextSyncToken}`,
        'GET',
        undefined,
        s.t,
      );
      expect(response.status).toBe(200);
      expect((await response.json()).items[0].status).toBe('cancelled');
      restarted.app.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('recurring events', () => {
  const recurring = {
    ...timed,
    id: 'series',
    start: {
      dateTime: '2026-03-07T09:00:00-05:00',
      timeZone: 'America/New_York',
    },
    end: {
      dateTime: '2026-03-07T10:00:00-05:00',
      timeZone: 'America/New_York',
    },
    recurrence: ['RRULE:FREQ=DAILY;COUNT=3'],
  };
  test('expands across DST, supports instance edits/deletions and freeBusy', async () => {
    const s = await client();
    await s.api(path, 'POST', recurring);
    const list = await s.api(
      `${path}/series/instances?timeZone=America%2FNew_York`,
    );
    expect(
      list.items.map((e: { start: { dateTime: string } }) => e.start.dateTime),
    ).toEqual([
      '2026-03-07T09:00:00-05:00',
      '2026-03-08T09:00:00-04:00',
      '2026-03-09T09:00:00-04:00',
    ]);
    expect(list.items[1].id).toBe('series_20260308T130000Z');
    const second = list.items[1];
    await s.api(`${path}/${second.id}`, 'PATCH', {
      summary: 'Moved',
      start: { dateTime: '2026-03-08T11:00:00-04:00' },
      end: { dateTime: '2026-03-08T12:00:00-04:00' },
    });
    await s.api(`${path}/${list.items[2].id}`, 'DELETE', undefined, 204);
    const changed = await s.api(`${path}/series/instances?showDeleted=true`);
    expect(changed.items[1].originalStartTime).toEqual(
      second.originalStartTime,
    );
    expect(changed.items[1].summary).toBe('Moved');
    expect(changed.items[2].status).toBe('cancelled');
    const free = await s.api('/calendar/v3/freeBusy', 'POST', {
      timeMin: '2026-03-07T00:00:00Z',
      timeMax: '2026-03-10T00:00:00Z',
      items: [{ id: 'primary' }],
    });
    expect(free.calendars.primary.busy).toEqual([
      { start: '2026-03-07T14:00:00+00:00', end: '2026-03-07T15:00:00+00:00' },
      { start: '2026-03-08T15:00:00+00:00', end: '2026-03-08T16:00:00+00:00' },
    ]);
  });
  test('trimming a series cancels removed instances in incremental sync', async () => {
    const s = await client();
    await s.api(path, 'POST', recurring);
    const initial = await s.api(
      `${path}?singleEvents=true&showDeleted=true&timeMin=2026-03-01T00:00:00Z&timeMax=2026-04-01T00:00:00Z`,
    );
    await s.api(`${path}/series`, 'PATCH', {
      recurrence: ['RRULE:FREQ=DAILY;COUNT=1'],
    });
    const result = await s.api(
      `${path}?singleEvents=true&showDeleted=true&syncToken=${initial.nextSyncToken}`,
    );
    expect(
      result.items.filter((e: { status: string }) => e.status === 'cancelled'),
    ).toHaveLength(2);
    await s.api(`${path}/series`, 'DELETE', undefined, 204);
    const cancelled = await s.api(
      `${path}?singleEvents=true&showDeleted=true&syncToken=${result.nextSyncToken}`,
    );
    expect(cancelled.items[0].status).toBe('cancelled');
  });
  test('all-day RRULE, RDATE and EXDATE preserve local dates', async () => {
    const s = await client();
    await s.api(path, 'POST', {
      ...timed,
      id: 'all-day',
      start: { date: '2026-10-01', dateTime: null, timeZone: null },
      end: { date: '2026-10-02', dateTime: null, timeZone: null },
      recurrence: [
        'RRULE:FREQ=DAILY;UNTIL=20261003',
        'EXDATE;VALUE=DATE:20261002',
        'RDATE;VALUE=DATE:20261005',
      ],
    });
    const list = await s.api(`${path}/all-day/instances`);
    expect(
      list.items.map((e: { start: { date: string } }) => e.start.date),
    ).toEqual(['2026-10-01', '2026-10-03', '2026-10-05']);
  });
  test('unbounded expansion fails explicitly without a window and accepts a bounded window', async () => {
    const s = await client();
    await s.api(path, 'POST', {
      ...timed,
      recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO,WE;WKST=MO'],
    });
    expect(
      (await s.api(path)).items.some(
        (e: { recurrence?: string[] }) => e.recurrence,
      ),
    ).toBe(true);
    await s.api(`${path}?singleEvents=true`, 'GET', undefined, 400);
    expect(
      (
        await s.api(
          `${path}/appointment/instances?timeMin=2026-10-19T00:00:00Z&timeMax=2026-10-26T00:00:00Z`,
        )
      ).items,
    ).toHaveLength(2);
  });
});

test('local invitations, RSVP propagation, cancellation and sendUpdates modes', async () => {
  const s = await client();
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
  expect((await s.api(`${path}/appointment`)).attendees[0].responseStatus).toBe(
    'accepted',
  );
  expect(s.app.workspace.notifications[1]?.method).toBe('REPLY');
  await s.api(`${path}/appointment?sendUpdates=none`, 'DELETE', undefined, 204);
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
  const s = await client();
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
  expect((await s.api(`${path}/appointment`)).attendees[0].responseStatus).toBe(
    'needsAction',
  );
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

test('recurrence UNTIL, monthly ordinal weekdays, and exceptions survive restart', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'calendarpit-recurrence-'));
  const database = join(dir, 'state.sqlite');
  try {
    const s = await client({ database });
    await s.api(path, 'POST', {
      ...timed,
      start: { dateTime: '2026-10-30T10:00:00+09:00', timeZone: 'Asia/Tokyo' },
      end: { dateTime: '2026-10-30T11:00:00+09:00', timeZone: 'Asia/Tokyo' },
      recurrence: ['RRULE:FREQ=MONTHLY;BYDAY=-1FR;UNTIL=20261225T010000Z'],
    });
    const list = await s.api(`${path}/appointment/instances`);
    expect(
      list.items.map((e: { start: { dateTime: string } }) => e.start.dateTime),
    ).toEqual([
      '2026-10-30T10:00:00+09:00',
      '2026-11-27T10:00:00+09:00',
      '2026-12-25T10:00:00+09:00',
    ]);
    await s.api(`${path}/${list.items[1].id}`, 'PATCH', {
      summary: 'Exception',
    });
    const original = s.app.workspace.data.events.find(
      (e) => e.id === list.items[1].id,
    )!;
    s.app.close();
    const next = await client({ database });
    const restored = await next.api(`${path}/${original.id}`);
    expect(restored.summary).toBe('Exception');
    expect(restored.etag).toBe(original.etag);
    expect(restored.originalStartTime).toEqual(original.originalStartTime);
    next.app.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('recurrence rejects malformed rules and DST-gap occurrences explicitly', async () => {
  const s = await client();
  for (const recurrence of [
    ['RRULE:FREQ=DAILY;COUNT='],
    ['RRULE:FREQ=WEEKLY;BYDAY=1MO'],
  ])
    await s.api(path, 'POST', { ...timed, recurrence }, 400);
  await s.api(path, 'POST', {
    ...timed,
    start: {
      dateTime: '2026-03-07T02:30:00-05:00',
      timeZone: 'America/New_York',
    },
    end: {
      dateTime: '2026-03-07T03:30:00-05:00',
      timeZone: 'America/New_York',
    },
    recurrence: ['RRULE:FREQ=DAILY;COUNT=2'],
  });
  const response = await s.api(
    `${path}/appointment/instances`,
    'GET',
    undefined,
    400,
  );
  expect(response.error.errors[0].reason).toBe('unsupportedFeature');
});
