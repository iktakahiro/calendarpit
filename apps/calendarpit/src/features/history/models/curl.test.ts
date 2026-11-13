import { expect, test } from 'bun:test';
import type { History } from '@calendarpit/server';
import { buildCurl } from './curl';

const row = (changes: Partial<History>): History => ({
  id: '1',
  time: '',
  method: 'GET',
  path: '/calendar/v3/events?q=one',
  status: 200,
  request: null,
  response: null,
  headers: {},
  responseHeaders: {},
  ...changes,
});

test('quotes JSON, headers and paths for a shell and omits hop-by-hop headers', () => {
  expect(
    buildCurl(
      row({
        method: 'POST',
        path: "/events?name=O'Brien",
        request: { summary: "Bob's event" },
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer [REDACTED]',
          host: 'localhost',
          'content-length': '10',
          connection: 'keep-alive, X-Internal',
          'x-internal': 'skip',
        },
      }),
      'http://localhost:3000',
    ),
  ).toBe(
    `curl --globoff -X 'POST' 'http://localhost:3000/events?name=O'\\''Brien' -H 'content-type: application/json' -H 'authorization: Bearer [REDACTED]' --data-raw '{"summary":"Bob'\\''s event"}'`,
  );
});

test('encodes recorded form fields and omits absent or unparsed bodies', () => {
  expect(
    buildCurl(
      row({
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        request: { code: '[REDACTED]', scope: 'a b' },
      }),
      'http://localhost',
    ),
  ).toContain("--data-raw 'code=%5BREDACTED%5D&scope=a+b'");
  expect(
    buildCurl(row({ request: '[Unparsed body]' }), 'http://localhost'),
  ).not.toContain('--data-raw');
  expect(buildCurl(row({}), 'http://localhost')).toBe(
    "curl --globoff -X 'GET' 'http://localhost/calendar/v3/events?q=one'",
  );
});

test('replays literal query values and empty and nonempty headers', async () => {
  const received: {
    url: string;
    empty: string | null;
    other: string | null;
  }[] = [];
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      received.push({
        url: request.url,
        empty: request.headers.get('if-match'),
        other: request.headers.get('x-test'),
      });
      return new Response(null, {
        status: request.headers.has('if-match') ? 412 : 200,
      });
    },
  });
  try {
    for (const path of ['/events?tag=[work]', '/events?tag={work,home}']) {
      const command = buildCurl(
        row({ path, headers: { 'if-match': '', 'x-test': 'value' } }),
        server.url.origin,
      );
      expect(command).toContain("-H 'if-match;'");
      expect(command).toContain("-H 'x-test: value'");
      const process = Bun.spawn(
        ['/bin/sh', '-c', `${command} -s -o /dev/null -w '%{http_code}'`],
        { stdout: 'pipe' },
      );
      expect(await new Response(process.stdout).text()).toBe('412');
      expect(await process.exited).toBe(0);
    }
    expect(received).toEqual([
      {
        url: `${server.url.origin}/events?tag=[work]`,
        empty: '',
        other: 'value',
      },
      {
        url: `${server.url.origin}/events?tag={work,home}`,
        empty: '',
        other: 'value',
      },
    ]);
  } finally {
    server.stop();
  }
});

test('replays HEAD without waiting for the advertised response body', async () => {
  const methods: string[] = [];
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      methods.push(request.method);
      return new Response(null, {
        status: 405,
        headers: { 'content-length': '162' },
      });
    },
  });
  try {
    const command = buildCurl(row({ method: 'HEAD' }), server.url.origin);
    expect(command).toContain(' --head ');
    expect(command).not.toContain("-X 'HEAD'");
    const process = Bun.spawn([
      '/bin/sh',
      '-c',
      `${command} --max-time 2 -s -o /dev/null`,
    ]);
    expect(await process.exited).toBe(0);
    expect(methods).toEqual(['HEAD']);
  } finally {
    server.stop();
  }
});
