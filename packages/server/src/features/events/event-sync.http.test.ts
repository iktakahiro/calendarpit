import { describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resetWorkspace } from '../fixtures/fixture-operations';
import { apiClient, setup } from '../../testing/server-harness';

const path = '/calendar/v3/calendars/primary/events';
const timed = {
  id: 'appointment',
  summary: 'Appointment',
  start: { dateTime: '2026-10-19T10:00:00+09:00', timeZone: 'Asia/Tokyo' },
  end: { dateTime: '2026-10-19T11:00:00+09:00', timeZone: 'Asia/Tokyo' },
};

describe('incremental sync', () => {
  test('frozen pagination does not lose writes; updates and tombstones are delivered once', async () => {
    const s = await apiClient();
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
    const s = await apiClient({ now: () => now });
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
      const s = await apiClient({ database, deliver });
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
