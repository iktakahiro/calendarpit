import { describe, expect, test } from 'bun:test';
import { apiClient, setup } from '../../testing/server-harness';

const list = '/calendar/v3/users/me/calendarList';
const calendarListScope =
  'https://www.googleapis.com/auth/calendar.calendarlist';
const calendarListReadScope = `${calendarListScope}.readonly`;

describe('calendarList', () => {
  test('get matches list, including primary, and hides other users', async () => {
    const s = await apiClient();
    const listed = await s.api(list);
    expect(listed.kind).toBe('calendar#calendarList');
    expect(listed.etag).toBe((await s.api(list)).etag);
    for (const item of listed.items)
      expect(await s.api(`${list}/${item.id}`)).toEqual(item);
    const primary = await s.api(`${list}/primary`);
    expect(primary).toEqual(
      listed.items.find((item: { primary: boolean }) => item.primary),
    );
    expect(primary).toMatchObject({
      kind: 'calendar#calendarListEntry',
      id: 'alex-work',
      accessRole: 'owner',
      selected: true,
      colorId: '1',
      backgroundColor: '#ac725e',
      foregroundColor: '#1d1d1d',
      defaultReminders: [],
      conferenceProperties: {
        allowedConferenceSolutionTypes: ['hangoutsMeet'],
      },
    });
    expect(primary.hidden).toBeUndefined();
    expect(primary.etag).toBe((await s.api(`${list}/primary`)).etag);
    await s.api(`${list}/sam-work`, 'GET', undefined, 404);
    await s.api(list, 'POST', { id: 'missing' }, 404);
  });

  test('patch preserves fields, update replaces them, and null clears', async () => {
    const s = await apiClient();
    const patched = await s.api(`${list}/alex-personal`, 'PATCH', {
      summaryOverride: 'Home',
      colorId: '14',
      defaultReminders: [{ method: 'popup', minutes: 10 }],
      notificationSettings: {
        notifications: [{ type: 'eventChange', method: 'email' }],
      },
    });
    expect(patched).toMatchObject({
      summary: 'Personal',
      summaryOverride: 'Home',
      selected: true,
      colorId: '14',
      backgroundColor: '#9fe1e7',
      foregroundColor: '#1d1d1d',
      defaultReminders: [{ method: 'popup', minutes: 10 }],
    });
    expect(await s.api(`${list}/alex-personal`)).toEqual(patched);
    const echoed = await s.api(`${list}/alex-personal`, 'PATCH', {
      ...patched,
      hidden: true,
    });
    expect(echoed.summaryOverride).toBe('Home');
    expect(echoed.hidden).toBe(true);
    expect(
      (await s.api(list)).items.map((item: { id: string }) => item.id),
    ).toEqual(['alex-work']);
    expect(
      (await s.api(`${list}?showHidden=true`)).items.map(
        (item: { id: string }) => item.id,
      ),
    ).toEqual(['alex-work', 'alex-personal']);
    const replaced = await s.api(`${list}/alex-personal`, 'PUT', {
      summaryOverride: 'House',
    });
    expect(replaced.summaryOverride).toBe('House');
    expect(replaced.selected).toBe(false);
    expect(replaced.hidden).toBeUndefined();
    expect(replaced.colorId).toBe('1');
    expect(replaced.defaultReminders).toEqual([]);
    expect(replaced.notificationSettings).toBeUndefined();
    const cleared = await s.api(`${list}/alex-personal`, 'PATCH', {
      summaryOverride: null,
    });
    expect(cleared.summaryOverride).toBeUndefined();
    expect(cleared.selected).toBe(false);
  });

  test('delete removes a non-primary calendar from the list and insert restores it', async () => {
    const s = await apiClient();
    await s.api('/calendar/v3/calendars/alex-personal/events', 'POST', {
      id: 'stay',
      summary: 'Still here',
      start: { dateTime: '2026-10-19T12:00:00+09:00' },
      end: { dateTime: '2026-10-19T13:00:00+09:00' },
    });
    await s.api(`${list}/alex-personal`, 'PATCH', { summaryOverride: 'Home' });
    expect(
      (await s.api(`${list}/primary`, 'DELETE', undefined, 403)).error.errors[0]
        .reason,
    ).toBe('cannotDeletePrimaryCalendar');
    await s.api(list, 'POST', { id: 'alex-personal' }, 409);
    await s.api(`${list}/alex-personal`, 'DELETE', undefined, 204);
    await s.api(`${list}/alex-personal`, 'GET', undefined, 404);
    await s.api('/calendar/v3/calendars/alex-personal/events/stay');
    expect((await s.api(list)).items).toHaveLength(1);
    expect(
      (await s.api(`${list}?showDeleted=true`)).items.find(
        (item: { id: string }) => item.id === 'alex-personal',
      ),
    ).toMatchObject({ deleted: true, summaryOverride: 'Home' });
    await s.api(`${list}/alex-work`, 'PATCH', { hidden: true });
    await s.api(list, 'POST', { id: 'primary' }, 409);
    const restored = await s.api(list, 'POST', {
      id: 'alex-personal',
      summaryOverride: 'Again',
      selected: true,
    });
    expect(restored.deleted).toBeUndefined();
    expect(restored.summaryOverride).toBe('Again');
    expect(await s.api(`${list}/alex-personal`)).toEqual(restored);
    await s.api(`${list}/sam-work`, 'DELETE', undefined, 404);
  });

  test('colors round-trip only through colorId or colorRgbFormat', async () => {
    const s = await apiClient();
    const custom = await s.api(
      `${list}/alex-work?colorRgbFormat=true`,
      'PATCH',
      {
        backgroundColor: '#FF0000',
        foregroundColor: '#ffffff',
      },
    );
    expect(custom.colorId).toBe('3');
    expect(custom.backgroundColor).toBe('#ff0000');
    expect(custom.foregroundColor).toBe('#ffffff');
    const rejected = await s.api(
      `${list}/alex-work`,
      'PATCH',
      { backgroundColor: '#00ff00' },
      400,
    );
    expect(rejected.error.message).toContain('colorRgbFormat=true');
    const echoed = await s.api(`${list}/alex-work`, 'PATCH', {
      backgroundColor: '#ff0000',
      foregroundColor: '#ffffff',
      summaryOverride: 'Desk',
    });
    expect(echoed.colorId).toBe('3');
    expect(echoed.summaryOverride).toBe('Desk');
    expect(
      (await s.api(`${list}/alex-work`, 'PATCH', { description: 'nope' }, 400))
        .error.errors[0].reason,
    ).toBe('unsupportedFeature');
    expect(
      (await s.api(`${list}?syncToken=abc`, 'GET', undefined, 400)).error
        .errors[0].reason,
    ).toBe('unsupportedFeature');
    const roundTrip = await s.api(`${list}/alex-work`, 'PATCH', echoed);
    expect(roundTrip.backgroundColor).toBe('#ff0000');
    expect(roundTrip.colorId).toBe('3');
    const overridden = await s.api(
      `${list}/alex-work?colorRgbFormat=true`,
      'PATCH',
      {
        colorId: 'constructor',
        backgroundColor: '#00ff00',
        foregroundColor: '#111111',
      },
    );
    expect(overridden.backgroundColor).toBe('#00ff00');
    expect(overridden.colorId).not.toBe('constructor');
  });

  test('rejects inherited colorId values without storing them', async () => {
    const s = await apiClient();
    const before = await s.api(`${list}/alex-personal`);
    for (const colorId of ['constructor', 'toString', '__proto__']) {
      const rejected = await s.api(
        `${list}/alex-personal`,
        'PATCH',
        { colorId },
        400,
      );
      expect(rejected.error.message).toContain('Invalid calendar colorId.');
    }
    expect(await s.api(`${list}/alex-personal`)).toEqual(before);
  });

  test('an empty notificationSettings object does not clear notifications', async () => {
    const s = await apiClient();
    await s.api(`${list}/alex-personal`, 'PATCH', {
      notificationSettings: {
        notifications: [{ type: 'agenda', method: 'email' }],
      },
    });
    const kept = await s.api(`${list}/alex-personal`, 'PATCH', {
      notificationSettings: {},
    });
    expect(kept.notificationSettings).toEqual({
      notifications: [{ type: 'agenda', method: 'email' }],
    });
    const cleared = await s.api(`${list}/alex-personal`, 'PATCH', {
      notificationSettings: { notifications: [] },
    });
    expect(cleared.notificationSettings).toBeUndefined();
  });

  test('promoting a removed calendar puts the primary calendar back on the list', async () => {
    const s = await apiClient();
    await s.api(`${list}/alex-personal`, 'PATCH', {
      summaryOverride: 'Home',
      selected: false,
    });
    await s.api(`${list}/alex-personal`, 'DELETE', undefined, 204);
    await s.api('/__calendarpit/calendars/alex-work', 'DELETE', undefined, 204);
    const primary = await s.api(`${list}/primary`);
    expect(primary).toMatchObject({
      id: 'alex-personal',
      primary: true,
      summaryOverride: 'Home',
      selected: false,
    });
    expect(
      (await s.api(list)).items.map((item: { id: string }) => item.id),
    ).toEqual(['alex-personal']);

    const again = await apiClient();
    await again.api(`${list}/alex-personal`, 'PATCH', {
      summaryOverride: 'Home',
    });
    await again.api(`${list}/alex-personal`, 'DELETE', undefined, 204);
    await again.api('/__calendarpit/calendars/alex-personal', 'PATCH', {
      primary: true,
    });
    expect(await again.api(`${list}/primary`)).toMatchObject({
      id: 'alex-personal',
      primary: true,
      summaryOverride: 'Home',
    });
    expect(
      (await again.api(list)).items.map((item: { id: string }) => item.id),
    ).toEqual(['alex-work', 'alex-personal']);
  });

  test('scopes separate calendar-list reads, writes, and watches', async () => {
    const s = setup({
      deliver: async () => new Response(null, { status: 204 }),
    });
    const read = await s.token(calendarListReadScope);
    expect(
      (await s.request(list, 'GET', undefined, read.access_token)).status,
    ).toBe(200);
    expect(
      (
        await s.request(
          `${list}/primary`,
          'PATCH',
          { selected: true },
          read.access_token,
        )
      ).status,
    ).toBe(403);
    const watched = await s.request(
      `${list}/watch`,
      'POST',
      {
        id: 'reader',
        type: 'web_hook',
        address: 'http://127.0.0.1:5555/hook',
      },
      read.access_token,
    );
    expect(watched.status).toBe(200);
    const channel = await watched.json();
    expect(
      (
        await s.request(
          '/calendar/v3/channels/stop',
          'POST',
          { id: channel.id, resourceId: channel.resourceId },
          read.access_token,
        )
      ).status,
    ).toBe(204);
    const write = await s.token(calendarListScope);
    expect(
      (
        await s.request(
          `${list}/alex-personal`,
          'PATCH',
          { selected: false },
          write.access_token,
        )
      ).status,
    ).toBe(200);
    const events = await s.token(
      'https://www.googleapis.com/auth/calendar.events',
    );
    expect(
      (await s.request(list, 'GET', undefined, events.access_token)).status,
    ).toBe(403);
  });

  test('list changes notify calendar-list watches and invalidate page tokens', async () => {
    const messages: { id: string | null; state: string | null }[] = [];
    const s = setup({
      deliver: async (_url, init) => {
        const headers = new Headers(init?.headers);
        messages.push({
          id: headers.get('X-Goog-Channel-ID'),
          state: headers.get('X-Goog-Resource-State'),
        });
        return new Response(null, { status: 204 });
      },
    });
    const { access_token: t } = await s.token();
    const watched = await (
      await s.request(
        `${list}/watch`,
        'POST',
        {
          id: 'list-channel',
          type: 'web_hook',
          address: 'http://127.0.0.1:5555/hook',
          token: 'list-secret',
        },
        t,
      )
    ).json();
    await s.request(
      '/calendar/v3/calendars/primary/events/watch',
      'POST',
      {
        id: 'event-channel',
        type: 'web_hook',
        address: 'http://127.0.0.1:5555/events',
      },
      t,
    );
    await s.app.drain();
    const page = await (
      await s.request(`${list}?maxResults=1`, 'GET', undefined, t)
    ).json();
    const stale = await s.request(
      `${list}/primary`,
      'PATCH',
      { selected: true },
      t,
      { 'If-Match': '"stale"' },
    );
    expect(stale.status).toBe(412);
    const entry = await (
      await s.request(`${list}/primary`, 'GET', undefined, t)
    ).json();
    expect(
      (
        await s.request(`${list}/primary`, 'PATCH', { selected: false }, t, {
          'If-Match': entry.etag,
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await s.request(
          `${list}?maxResults=1&pageToken=${page.nextPageToken}`,
          'GET',
          undefined,
          t,
        )
      ).status,
    ).toBe(410);
    await s.request(
      '/calendar/v3/calendars/primary/events',
      'POST',
      {
        id: 'note',
        summary: 'Note',
        start: { dateTime: '2026-10-19T12:00:00+09:00' },
        end: { dateTime: '2026-10-19T13:00:00+09:00' },
      },
      t,
    );
    await s.request('/__calendarpit/calendars/alex-personal', 'PATCH', {
      summary: 'Renamed',
    });
    await s.app.drain();
    expect(
      messages
        .filter((message) => message.id === 'list-channel')
        .map((message) => message.state),
    ).toEqual(['sync', 'exists', 'exists']);
    expect(
      messages
        .filter((message) => message.id === 'event-channel')
        .map((message) => message.state),
    ).toEqual(['sync', 'exists']);
    expect(JSON.stringify(s.app.workspace.history)).not.toContain(
      'list-secret',
    );
    await s.request(
      '/calendar/v3/channels/stop',
      'POST',
      { id: watched.id, resourceId: watched.resourceId },
      t,
    );
    await s.request(`${list}/alex-personal`, 'PATCH', { selected: true }, t);
    await s.app.drain();
    expect(
      messages.filter((message) => message.id === 'list-channel'),
    ).toHaveLength(3);
    await s.request('/__calendarpit/reset', 'POST', {});
    expect(s.app.workspace.calendarListEntries).toEqual([]);
  });
});
