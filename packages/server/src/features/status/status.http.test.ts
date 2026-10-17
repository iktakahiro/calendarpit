import { describe, expect, test } from 'bun:test';
import { setup } from '../../testing/server-harness';

describe('health and state', () => {
  test('health answers GET and HEAD without management headers', async () => {
    const s = setup();
    const get = await s.request(
      '/__calendarpit/health',
      'GET',
      undefined,
      undefined,
      {
        Origin: 'https://elsewhere.test',
      },
    );
    expect(get.status).toBe(200);
    expect(await get.json()).toMatchObject({
      name: 'Calendarpit',
      storage: 'memory',
    });
    const head = await s.request('/__calendarpit/health', 'HEAD');
    expect([head.status, await head.text()]).toEqual([200, '']);
    const post = await s.request('/__calendarpit/health', 'POST', {});
    expect([post.status, post.headers.get('allow')]).toEqual([
      405,
      'GET, HEAD',
    ]);
  });

  test('state redacts client secrets', async () => {
    const s = setup();
    const state = await (await s.request('/__calendarpit/state')).json();
    expect(state.clients).toEqual([
      { id: 'sample-app', redirectUris: ['http://127.0.0.1:4175/callback'] },
    ]);
  });

  test('management writes require JSON and known endpoints', async () => {
    const s = setup();
    const form = await s.form('/__calendarpit/reset', {});
    expect(form.status).toBe(415);
    const unknown = await s.request('/__calendarpit/unknown', 'POST', {});
    expect(unknown.status).toBe(404);
  });
});
