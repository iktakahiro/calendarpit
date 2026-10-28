import { describe, expect, test } from 'bun:test';
import { apiClient, setup } from '../../testing/server-harness';

const path = '/calendar/v3/freeBusy';
const calendarScope = 'https://www.googleapis.com/auth/calendar';
// The fixture's `planning` event on alex-work: 10:00-11:00 in Tokyo.
const query = {
  timeMin: '2026-10-19T00:00:00Z',
  timeMax: '2026-10-20T00:00:00Z',
  items: [{ id: 'primary' }],
};

async function expectError(
  response: Response,
  status: number,
  reason: string,
  message: string,
) {
  expect(response.status).toBe(status);
  expect(await response.json()).toEqual({
    error: {
      code: status,
      message,
      errors: [{ domain: 'calendarpit', reason, message }],
    },
  });
}

describe('freeBusy.query request validation', () => {
  test('rejects timeMax that is not after timeMin', async () => {
    const s = await apiClient();
    for (const timeMax of [query.timeMin, '2026-10-18T00:00:00Z'])
      await expectError(
        await s.request(path, 'POST', { ...query, timeMax }, s.t),
        400,
        'invalidParameter',
        'timeMax must be after timeMin.',
      );
  });

  test.each([
    ['missing timeMin', { timeMin: undefined }],
    ['timeMin without an offset', { timeMin: '2026-10-19T00:00:00' }],
    ['non-string timeMax', { timeMax: 12 }],
  ])('rejects %s', async (_name, change) => {
    const s = await apiClient();
    const response = await s.request(
      path,
      'POST',
      { ...query, ...change },
      s.t,
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error.errors[0].reason).toBe(
      'invalidParameter',
    );
  });

  test('rejects an invalid timeZone', async () => {
    const s = await apiClient();
    await expectError(
      await s.request(path, 'POST', { ...query, timeZone: 'Mars/Base' }, s.t),
      400,
      'invalidParameter',
      'Invalid IANA time zone.',
    );
  });

  test('rejects calendar groups as an unsupported feature', async () => {
    const s = await apiClient();
    for (const groupExpansionMax of [1, 100])
      await expectError(
        await s.request(path, 'POST', { ...query, groupExpansionMax }, s.t),
        400,
        'unsupportedFeature',
        'Calendar groups are not supported.',
      );
  });

  test('rejects missing or non-array items and more than 50 items', async () => {
    const s = await apiClient();
    const message = 'items must contain at most 50 calendars.';
    for (const items of [undefined, 'primary', { id: 'primary' }])
      await expectError(
        await s.request(path, 'POST', { ...query, items }, s.t),
        400,
        'invalidParameter',
        message,
      );
    const ids = (count: number) =>
      Array.from({ length: count }, (_, i) => ({ id: `unknown-${i}` }));
    await expectError(
      await s.request(path, 'POST', { ...query, items: ids(51) }, s.t),
      400,
      'invalidParameter',
      message,
    );
    const fifty = await s.api(path, 'POST', { ...query, items: ids(50) });
    expect(Object.keys(fifty.calendars)).toHaveLength(50);
  });

  test.each([0, 51, 1.5, -1, '5', null, true])(
    'rejects calendarExpansionMax %p',
    async (calendarExpansionMax) => {
      const s = await apiClient();
      await expectError(
        await s.request(path, 'POST', { ...query, calendarExpansionMax }, s.t),
        400,
        'invalidParameter',
        'Invalid calendarExpansionMax.',
      );
    },
  );

  test('accepts calendarExpansionMax from 1 to 50 and rejects more items than it', async () => {
    const s = await apiClient();
    for (const calendarExpansionMax of [1, 50])
      expect(
        (await s.api(path, 'POST', { ...query, calendarExpansionMax }))
          .calendars.primary.busy,
      ).toHaveLength(1);
    await expectError(
      await s.request(
        path,
        'POST',
        {
          ...query,
          calendarExpansionMax: 2,
          items: [{ id: 'primary' }, { id: 'alex-personal' }, { id: 'x' }],
        },
        s.t,
      ),
      400,
      'invalidParameter',
      'Too many calendars.',
    );
    const two = await s.api(path, 'POST', {
      ...query,
      calendarExpansionMax: 2,
      items: [{ id: 'primary' }, { id: 'alex-personal' }],
    });
    expect(Object.keys(two.calendars)).toEqual(['primary', 'alex-personal']);
  });

  test('rejects unknown fields in the body and in items', async () => {
    const s = await apiClient();
    await expectError(
      await s.request(path, 'POST', { ...query, extra: true }, s.t),
      400,
      'unsupportedFeature',
      'Unsupported field: extra',
    );
    await expectError(
      await s.request(
        path,
        'POST',
        { ...query, items: [{ id: 'primary', extra: true }] },
        s.t,
      ),
      400,
      'unsupportedFeature',
      'Unsupported field: extra',
    );
  });

  test.each([
    ['a missing id', [{}]],
    ['a blank id', [{ id: ' ' }]],
    ['a numeric id', [{ id: 1 }]],
    ['a non-object item', ['primary']],
  ])('rejects an item with %s', async (_name, items) => {
    const s = await apiClient();
    const response = await s.request(path, 'POST', { ...query, items }, s.t);
    expect(response.status).toBe(400);
  });

  test('rejects an invalid JSON body, a non-object body, and query parameters', async () => {
    const s = await apiClient();
    const post = (body: string, search = '') =>
      s.app.handle(
        new Request(`http://127.0.0.1:4173${path}${search}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${s.t}`,
          },
          body,
        }),
      );
    await expectError(
      (await post('{'))!,
      400,
      'invalidParameter',
      'Invalid JSON body.',
    );
    await expectError(
      (await post('[]'))!,
      400,
      'invalidParameter',
      'Expected a JSON object.',
    );
    await expectError(
      (await post(JSON.stringify(query), '?fields=calendars'))!,
      400,
      'unsupportedFeature',
      'Unsupported query parameter: fields',
    );
  });

  test('does not handle methods other than POST', async () => {
    const s = await apiClient();
    for (const method of ['GET', 'PUT', 'PATCH', 'DELETE'])
      await expectError(
        await s.request(
          path,
          method,
          method === 'GET' ? undefined : query,
          s.t,
        ),
        501,
        'unsupportedFeature',
        'Unsupported API endpoint or method.',
      );
  });
});

describe('freeBusy.query authorization', () => {
  test('rejects a missing, malformed, or unknown token with 401', async () => {
    const s = setup();
    for (const token of [undefined, 'not-a-token'])
      await expectError(
        await s.request(path, 'POST', query, token),
        401,
        'authError',
        'Invalid or expired access token.',
      );
    // Authentication comes before body validation.
    await expectError(
      await s.request(path, 'POST', { bogus: true }),
      401,
      'authError',
      'Invalid or expired access token.',
    );
  });

  test.each([
    'https://www.googleapis.com/auth/calendar.calendarlist',
    'https://www.googleapis.com/auth/calendar.calendars.readonly',
    'openid email',
  ])('rejects a token with only %s', async (scope) => {
    const s = setup();
    const { access_token } = await s.token(scope);
    await expectError(
      await s.request(path, 'POST', query, access_token),
      403,
      'insufficientPermissions',
      'Insufficient scope.',
    );
  });

  test.each([
    calendarScope,
    `${calendarScope}.readonly`,
    `${calendarScope}.events`,
    `${calendarScope}.events.readonly`,
    `${calendarScope}.freebusy`,
    `${calendarScope}.events.freebusy`,
  ])('accepts a token with scope %s', async (scope) => {
    const s = setup();
    const { access_token } = await s.token(scope);
    const response = await s.request(path, 'POST', query, access_token);
    expect(response.status).toBe(200);
  });
});

describe('freeBusy.query results', () => {
  test('reports per-calendar notFound for unknown and foreign calendars', async () => {
    const s = await apiClient();
    const result = await s.api(path, 'POST', {
      ...query,
      items: [
        { id: 'does-not-exist' },
        { id: 'primary' },
        { id: 'sam-work' },
        { id: 'alex-personal' },
      ],
    });
    const notFound = {
      errors: [{ domain: 'global', reason: 'notFound' }],
      busy: [],
    };
    expect(result).toEqual({
      kind: 'calendar#freeBusy',
      timeMin: query.timeMin,
      timeMax: query.timeMax,
      calendars: {
        'does-not-exist': notFound,
        primary: {
          busy: [
            {
              start: '2026-10-19T01:00:00+00:00',
              end: '2026-10-19T02:00:00+00:00',
            },
          ],
        },
        'sam-work': notFound,
        'alex-personal': { busy: [] },
      },
    });
  });

  test("another user's primary alias resolves to the caller's own calendar", async () => {
    const s = setup();
    const { access_token } = await s.token(calendarScope, 'sam');
    const response = await s.request(
      path,
      'POST',
      { ...query, items: [{ id: 'primary' }, { id: 'alex-work' }] },
      access_token,
    );
    const { calendars } = await response.json();
    expect(calendars.primary).toEqual({ busy: [] });
    expect(calendars['alex-work'].errors).toEqual([
      { domain: 'global', reason: 'notFound' },
    ]);
  });

  test('keeps a calendar id that matches an Object prototype key', async () => {
    const s = await apiClient();
    const result = await s.api(path, 'POST', {
      ...query,
      items: [{ id: 'constructor' }, { id: 'toString' }],
    });
    expect(Object.keys(result.calendars)).toEqual(['constructor', 'toString']);
    expect(result.calendars.constructor.errors[0].reason).toBe('notFound');
  });

  test('formats busy times in the requested timeZone without a zone name', async () => {
    const s = await apiClient();
    const cases: [string | undefined, string, string][] = [
      [undefined, '2026-10-19T01:00:00+00:00', '2026-10-19T02:00:00+00:00'],
      ['UTC', '2026-10-19T01:00:00+00:00', '2026-10-19T02:00:00+00:00'],
      ['Asia/Tokyo', '2026-10-19T10:00:00+09:00', '2026-10-19T11:00:00+09:00'],
      [
        'America/New_York',
        '2026-10-18T21:00:00-04:00',
        '2026-10-18T22:00:00-04:00',
      ],
    ];
    for (const [timeZone, start, end] of cases) {
      const result = await s.api(path, 'POST', { ...query, timeZone });
      expect(result.calendars.primary.busy).toEqual([{ start, end }]);
    }
  });

  test('echoes timeMin and timeMax as sent and clips busy ranges to the window', async () => {
    const s = await apiClient();
    const timeMin = '2026-10-19T10:30:00+09:00';
    const timeMax = '2026-10-19T10:45:00+09:00';
    const result = await s.api(path, 'POST', {
      timeMin,
      timeMax,
      timeZone: 'Asia/Tokyo',
      items: [{ id: 'primary' }],
    });
    expect(result.timeMin).toBe(timeMin);
    expect(result.timeMax).toBe(timeMax);
    expect(result.calendars.primary.busy).toEqual([
      { start: '2026-10-19T10:30:00+09:00', end: '2026-10-19T10:45:00+09:00' },
    ]);
  });

  test('an empty items list returns an empty calendars map', async () => {
    const s = await apiClient();
    const result = await s.api(path, 'POST', { ...query, items: [] });
    expect(result.calendars).toEqual({});
  });
});
