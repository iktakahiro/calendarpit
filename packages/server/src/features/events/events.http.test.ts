import { describe, expect, test } from 'bun:test';
import { setup } from '../../testing/server-harness';

const timed = {
  id: 'test-event',
  summary: 'Busy',
  start: { dateTime: '2026-10-19T10:00:00+09:00' },
  end: { dateTime: '2026-10-19T11:00:00+09:00' },
};
const path = '/calendar/v3/calendars/primary/events';

describe('events', () => {
  test('CRUD, replacement, cancellation and free/busy remain consistent', async () => {
    const s = setup();
    const { access_token: t } = await s.token();
    expect((await s.request(path, 'POST', timed, t)).status).toBe(200);
    const free = () =>
      s
        .request(
          '/calendar/v3/freeBusy',
          'POST',
          {
            timeMin: '2026-10-19T01:30:00Z',
            timeMax: '2026-10-19T03:00:00Z',
            items: [{ id: 'primary' }],
          },
          t,
        )
        .then((r) => r.json());
    expect((await free()).calendars.primary.busy).toEqual([
      { start: '2026-10-19T01:30:00+00:00', end: '2026-10-19T02:00:00+00:00' },
    ]);
    await s.request(
      `${path}/test-event`,
      'PATCH',
      { description: 'keep', extendedProperties: { private: { appId: '42' } } },
      t,
    );
    const patched = await (
      await s.request(`${path}/test-event`, 'GET', undefined, t)
    ).json();
    expect(patched.summary).toBe('Busy');
    expect(patched.extendedProperties.private.appId).toBe('42');
    await s.request(
      `${path}/test-event`,
      'PUT',
      { start: timed.start, end: timed.end, transparency: 'transparent' },
      t,
    );
    const replaced = await (
      await s.request(`${path}/test-event`, 'GET', undefined, t)
    ).json();
    expect(replaced.description).toBeUndefined();
    expect(replaced.summary).toBe('');
    await s.request(`${path}/planning`, 'DELETE', undefined, t);
    expect((await free()).calendars.primary.busy).toEqual([]);
    await s.request(`${path}/test-event`, 'DELETE', undefined, t);
    expect(
      (
        await (
          await s.request(`${path}/test-event`, 'GET', undefined, t)
        ).json()
      ).status,
    ).toBe('cancelled');
  });
  test('list uses exclusive boundaries, stable pagination during concurrent writes', async () => {
    const s = setup();
    const { access_token: t } = await s.token();
    await s.request(
      path,
      'POST',
      {
        ...timed,
        id: 'later',
        start: { dateTime: '2026-10-19T11:00:00+09:00' },
        end: { dateTime: '2026-10-19T12:00:00+09:00' },
      },
      t,
    );
    const list = await (
      await s.request(
        `${path}?timeMin=2026-10-19T02:00:00Z&timeMax=2026-10-19T03:00:00Z`,
        'GET',
        undefined,
        t,
      )
    ).json();
    expect(list.items.map((e: { id: string }) => e.id)).toEqual(['later']);
    const first = await (
      await s.request(
        `${path}?maxResults=1&orderBy=startTime&singleEvents=true`,
        'GET',
        undefined,
        t,
      )
    ).json();
    expect(first.items[0].id).toBe('planning');
    const next = `${path}?maxResults=1&orderBy=startTime&singleEvents=true&pageToken=${first.nextPageToken}`;
    expect(
      (await (await s.request(next, 'GET', undefined, t)).json()).items[0].id,
    ).toBe('later');
    await s.request(`${path}/later`, 'PATCH', { summary: 'changed' }, t);
    expect(
      (await (await s.request(next, 'GET', undefined, t)).json()).items[0]
        .summary,
    ).not.toBe('changed');
  });
  test('rejects unsupported recurrence, fields and invalid dates without mutation', async () => {
    const s = setup();
    const { access_token: t } = await s.token();
    for (const body of [
      { ...timed, recurrence: ['RRULE:FREQ=DAILY'] },
      { ...timed, unsupportedProperty: true },
      { ...timed, start: { date: '2026-02-30' }, end: { date: '2026-03-01' } },
      { ...timed, end: timed.start },
    ])
      expect((await s.request(path, 'POST', body, t)).status).toBe(400);
    expect(
      (await s.request(`${path}?syncToken=old`, 'GET', undefined, t)).status,
    ).toBe(410);
    expect(s.app.workspace.data.events.length).toBe(1);
  });
});
