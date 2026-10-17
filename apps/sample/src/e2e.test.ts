import { expect, test } from 'bun:test';
import { createCalendarpit, defaultFixture } from '@calendarpit/server';
import { createSample } from './app';

test('Google SDK: approve → select → watch → CRUD/busy → stop → revoke → reconnect → deny → reset and repeat', async () => {
  let sample: ReturnType<typeof createSample>;
  const sampleServer = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    fetch: (r) => sample.handle(r),
  });
  const app = createCalendarpit({
    database: ':memory:',
    fixture: {
      ...defaultFixture,
      clients: [
        {
          id: 'sample-app',
          secret: 'local-sample-secret',
          redirectUris: [`${sampleServer.url.origin}/callback`],
        },
      ],
    },
  });
  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    fetch: async (r) =>
      (await app.handle(r)) ?? new Response('UI', { status: 200 }),
  });
  sample = createSample({
    provider: server.url.origin,
    origin: sampleServer.url.origin,
  });
  async function connect(deny = false) {
    const begin = await fetch(new URL('/connect', sampleServer.url), {
      redirect: 'manual',
    });
    const cookie = begin.headers.get('set-cookie')!.split(';')[0]!;
    const consent = await fetch(begin.headers.get('location')!);
    const html = await consent.text();
    const nonce = /name="consent" value="([^"]+)"/.exec(html)![1]!;
    const approved = await fetch(new URL('/oauth/authorize', server.url), {
      method: 'POST',
      body: new URLSearchParams({
        consent: nonce,
        user_id: 'alex',
        decision: deny ? 'deny' : 'approve',
      }),
      redirect: 'manual',
    });
    expect(approved.status).toBe(302);
    const callback = await fetch(approved.headers.get('location')!, {
      headers: { Cookie: cookie },
      redirect: 'manual',
    });
    expect(callback.status).toBe(302);
  }
  const action = async (action: string, extra: Record<string, string> = {}) => {
    const response = await fetch(new URL('/api/action', sampleServer.url), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...extra }),
    });
    const body = await response.json();
    expect(response.status, JSON.stringify(body)).toBe(200);
    return body;
  };
  const state = async () =>
    await (await fetch(new URL('/api/state', sampleServer.url))).json();
  try {
    for (let pass = 0; pass < 2; pass++) {
      await connect();
      expect((await state()).calendars).toHaveLength(2);
      await action('select', { calendarId: 'alex-work' });
      await action('watch');
      await app.store.drain();
      expect(sample.notifications.at(-1)!['x-goog-resource-state']).toBe(
        'sync',
      );
      const created = await action('create');
      expect(created.lastEventId).toBeTruthy();
      await app.store.drain();
      expect(sample.notifications.at(-1)!['x-goog-resource-state']).toBe(
        'exists',
      );
      const current = await state();
      expect(
        current.events.some(
          (e: { id: string }) => e.id === created.lastEventId,
        ),
      ).toBe(true);
      expect(current.busy.calendars['alex-work'].busy).toContainEqual({
        start: '2026-10-19T03:00:00+00:00',
        end: '2026-10-19T04:00:00+00:00',
      });
      await action('update', {
        summary: 'Changed',
        start: '2026-10-19T14:00:00+09:00',
        end: '2026-10-19T15:00:00+09:00',
      });
      expect(
        (await state()).events.find(
          (e: { id: string }) => e.id === created.lastEventId,
        ).summary,
      ).toBe('Changed');
      await action('delete');
      await app.store.drain();
      expect(
        (await state()).events.some(
          (e: { id: string }) => e.id === created.lastEventId,
        ),
      ).toBe(false);
      await action('stop');
      const count = sample.notifications.length;
      await action('create');
      await app.store.drain();
      expect(sample.notifications).toHaveLength(count);
      await action('delete');
      const listed = await sample.sdk.calendarList.list({
        minAccessRole: 'reader',
        showDeleted: false,
      });
      expect(listed.data.items).toHaveLength(2);
      const allDay = await sample.sdk.events.insert({
        calendarId: 'primary',
        sendUpdates: 'all',
        conferenceDataVersion: 1,
        requestBody: {
          id: 'sdk-all-day',
          summary: 'SDK all-day invitation',
          status: 'tentative',
          visibility: 'private',
          colorId: '3',
          start: { date: '2026-10-20', dateTime: null, timeZone: null },
          end: { date: '2026-10-21', dateTime: null, timeZone: null },
          attendees: [{ email: 'guest@example.test' }],
          reminders: {
            useDefault: false,
            overrides: [{ method: 'popup', minutes: 10 }],
          },
          extendedProperties: { private: { fixture: 'sdk' } },
          conferenceData: {
            createRequest: {
              requestId: 'sdk-meeting',
              conferenceSolutionKey: { type: 'hangoutsMeet' },
            },
          },
        },
      });
      expect(allDay.data.organizer?.self).toBe(true);
      expect(allDay.data.hangoutLink).toStartWith(
        'https://meet.calendarpit.invalid/',
      );
      const filtered = await sample.sdk.events.list({
        calendarId: 'primary',
        privateExtendedProperty: ['fixture=sdk'],
      });
      expect(filtered.data.items?.map((e) => e.id)).toEqual(['sdk-all-day']);
      const full = await sample.sdk.events.list({
        calendarId: 'primary',
        showDeleted: true,
      });
      await sample.sdk.events.delete({
        calendarId: 'primary',
        eventId: 'sdk-all-day',
        sendUpdates: 'none',
      });
      const delta = await sample.sdk.events.list({
        calendarId: 'primary',
        showDeleted: true,
        syncToken: full.data.nextSyncToken!,
      });
      expect(delta.data.items?.map((e) => [e.id, e.status])).toEqual([
        ['sdk-all-day', 'cancelled'],
      ]);
      const series = await sample.sdk.events.insert({
        calendarId: 'primary',
        requestBody: {
          id: 'sdk-series',
          summary: 'SDK recurring event',
          start: {
            dateTime: '2026-10-20T09:00:00+09:00',
            timeZone: 'Asia/Tokyo',
          },
          end: {
            dateTime: '2026-10-20T10:00:00+09:00',
            timeZone: 'Asia/Tokyo',
          },
          recurrence: ['RRULE:FREQ=DAILY;COUNT=2'],
        },
      });
      const occurrences = await sample.sdk.events.instances({
        calendarId: 'primary',
        eventId: series.data.id!,
      });
      expect(occurrences.data.items).toHaveLength(2);
      await sample.sdk.events.patch({
        calendarId: 'primary',
        eventId: occurrences.data.items![0]!.id!,
        requestBody: { summary: 'SDK exception' },
      });
      expect(
        (
          await sample.sdk.events.get({
            calendarId: 'primary',
            eventId: occurrences.data.items![0]!.id!,
          })
        ).data.summary,
      ).toBe('SDK exception');
      await sample.sdk.events.delete({
        calendarId: 'primary',
        eventId: series.data.id!,
      });
      await action('refresh');
      await action('revoke');
      expect((await state()).status).toContain('Revoked');
      await connect();
      const grant = [...app.store.grants.values()]
        .filter((g) => !g.revoked)
        .at(-1)!;
      const revoke = await fetch(
        new URL(`/__calendarpit/connections/${grant.id}/revoke`, server.url),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        },
      );
      expect(revoke.status).toBe(204);
      expect((await state()).status).toContain('Reconnect');
      await connect(true);
      expect((await state()).status).toContain('Authorization denied');
      expect(
        (
          await fetch(
            new URL('/callback?state=invalid&code=invalid', sampleServer.url),
          )
        ).status,
      ).toBe(400);
      const reset = await fetch(new URL('/__calendarpit/reset', server.url), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      expect(reset.status).toBe(200);
      expect(app.store.data.events.map((e) => e.id)).toEqual(['planning']);
      expect(app.store.history).toEqual([]);
      expect(app.store.grants.size).toBe(0);
    }
    expect(sample.requests.length).toBeGreaterThan(20);
    expect(
      sample.requests.every((url) => new URL(url).origin === server.url.origin),
    ).toBe(true);
  } finally {
    app.close();
    await app.store.drain();
    await server.stop(true);
    await sampleServer.stop(true);
  }
}, 20000);
