import { describe, expect, test } from 'bun:test';
import { findCalendar } from './calendar-operations';
import { apiClient, setup } from '../../testing/server-harness';

describe('calendars', () => {
  test('management CRUD maintains primary invariants and rejects cross-origin writes', async () => {
    const s = setup();
    expect(
      (
        await s.request('/__calendarpit/reset', 'POST', {}, undefined, {
          Origin: 'https://evil.test',
        })
      ).status,
    ).toBe(403);
    const c = await (
      await s.request('/__calendarpit/calendars', 'POST', {
        id: 'new',
        userId: 'alex',
        summary: 'New',
        primary: true,
        timeZone: 'UTC',
      })
    ).json();
    expect(c.primary).toBe(true);
    expect(findCalendar(s.app.workspace, 'alex-work').primary).toBe(false);
    await s.request('/__calendarpit/calendars/new', 'DELETE', {});
    expect(findCalendar(s.app.workspace, 'primary', 'alex').id).toBe(
      'alex-work',
    );
  });
  test('calendar-list role filtering and deletion visibility', async () => {
    const s = await apiClient();
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
