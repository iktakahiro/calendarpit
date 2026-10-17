import { describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { apiClient } from '../../testing/server-harness';

const path = '/calendar/v3/calendars/primary/events';
const timed = {
  id: 'appointment',
  summary: 'Appointment',
  start: { dateTime: '2026-10-19T10:00:00+09:00', timeZone: 'Asia/Tokyo' },
  end: { dateTime: '2026-10-19T11:00:00+09:00', timeZone: 'Asia/Tokyo' },
};

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
    const s = await apiClient();
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
    const s = await apiClient();
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
    const s = await apiClient();
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
    const s = await apiClient();
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
  test('recurrence UNTIL, monthly ordinal weekdays, and exceptions survive restart', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'calendarpit-recurrence-'));
    const database = join(dir, 'state.sqlite');
    try {
      const s = await apiClient({ database });
      await s.api(path, 'POST', {
        ...timed,
        start: {
          dateTime: '2026-10-30T10:00:00+09:00',
          timeZone: 'Asia/Tokyo',
        },
        end: { dateTime: '2026-10-30T11:00:00+09:00', timeZone: 'Asia/Tokyo' },
        recurrence: ['RRULE:FREQ=MONTHLY;BYDAY=-1FR;UNTIL=20261225T010000Z'],
      });
      const list = await s.api(`${path}/appointment/instances`);
      expect(
        list.items.map(
          (e: { start: { dateTime: string } }) => e.start.dateTime,
        ),
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
      const next = await apiClient({ database });
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
    const s = await apiClient();
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
});
