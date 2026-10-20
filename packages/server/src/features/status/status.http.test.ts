import { describe, expect, test } from 'bun:test';
import { apiClient, setup } from '../../testing/server-harness';

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

describe('change stream', () => {
  /** Reads a stream to its end and returns the text. */
  const readAll = async (body: ReadableStream<Uint8Array>) => {
    let text = '';
    const decoder = new TextDecoder();
    for await (const chunk of body) text += decoder.decode(chunk);
    return text;
  };

  test('emits change only for saved changes and ends when the workspace closes', async () => {
    const s = await apiClient();
    await s.request('/__calendarpit/history', 'DELETE', {});
    const stream = await s.request('/__calendarpit/changes');
    expect(stream.status).toBe(200);
    expect(stream.headers.get('content-type')).toBe('text/event-stream');

    // Clearing an empty history and reading state leave the snapshot unchanged.
    await s.request('/__calendarpit/history', 'DELETE', {});
    await s.request('/__calendarpit/state');
    await s.api('/calendar/v3/calendars/primary/events', 'POST', {
      summary: 'Pushed',
      start: { dateTime: '2026-10-19T12:00:00+09:00' },
      end: { dateTime: '2026-10-19T13:00:00+09:00' },
    });
    s.app.close();

    const text = await readAll(stream.body!);
    expect(text).toStartWith('retry: ');
    expect(text.match(/^event: change$/gm)).toHaveLength(1);
  });

  test('rejects cross-origin subscribers', async () => {
    const s = setup();
    const response = await s.request(
      '/__calendarpit/changes',
      'GET',
      undefined,
      undefined,
      { Origin: 'https://elsewhere.test' },
    );
    expect(response.status).toBe(403);
  });
});
