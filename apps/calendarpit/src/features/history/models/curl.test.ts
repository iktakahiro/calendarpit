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
    `curl -X 'POST' 'http://localhost:3000/events?name=O'\\''Brien' -H 'content-type: application/json' -H 'authorization: Bearer [REDACTED]' --data-raw '{"summary":"Bob'\\''s event"}'`,
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
    "curl -X 'GET' 'http://localhost/calendar/v3/events?q=one'",
  );
});
