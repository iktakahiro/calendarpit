import { describe, expect, test } from 'bun:test';
import { setup } from '../../testing/server-harness';

const list = '/calendar/v3/users/me/calendarList';
const events = '/calendar/v3/calendars/primary/events';
const freeBusy = {
  timeMin: '2026-10-19T00:00:00Z',
  timeMax: '2026-10-19T06:00:00Z',
  items: [{ id: 'primary' }],
};
const timed = (id: string) => ({
  id,
  summary: 'Busy',
  start: { dateTime: '2026-10-19T10:00:00+09:00' },
  end: { dateTime: '2026-10-19T11:00:00+09:00' },
});

const deliver = async () => new Response(null, { status: 204 });

async function quotaError(
  response: Response,
  status: number,
  reason: string,
  message: string,
) {
  expect(response.status).toBe(status);
  expect(Number(response.headers.get('retry-after'))).toBeGreaterThan(0);
  expect(await response.json()).toEqual({
    error: {
      code: status,
      message,
      errors: [{ domain: 'usageLimits', reason, message }],
    },
  });
}

describe('Calendar API rate limits', () => {
  test('off is the default and does not limit Calendar API requests', async () => {
    const s = setup();
    const { access_token: token } = await s.token();
    const state = await (await s.request('/__calendarpit/state')).json();
    expect(state.rateLimitMode).toBe('off');
    for (let i = 0; i < 5; i++)
      expect((await s.request(list, 'GET', undefined, token)).status).toBe(200);
  });

  test('strict shares one per-user budget across calendarList, freeBusy, and events', async () => {
    const s = setup({ rateLimitMode: 'strict' });
    const { access_token: token } = await s.token();
    const calls = [
      () => s.request(list, 'GET', undefined, token),
      () => s.request('/calendar/v3/freeBusy', 'POST', freeBusy, token),
      () => s.request(events, 'GET', undefined, token),
      () => s.request(list, 'GET', undefined, token),
    ];
    for (const call of calls) expect((await call()).status).toBe(200);
    await quotaError(
      await s.request(events, 'GET', undefined, token),
      403,
      'userRateLimitExceeded',
      'User Rate Limit Exceeded',
    );
    expect((await s.request('/__calendarpit/health')).status).toBe(200);
    const oauth = await s.form('/oauth/token', { grant_type: 'refresh_token' });
    expect(oauth.status).toBe(400);
  });

  test('strict limits writes per calendar, including watch, before the user quota', async () => {
    const s = setup({ rateLimitMode: 'strict', deliver });
    const { access_token: token } = await s.token();
    expect(
      (await s.request(events, 'POST', timed('write-primary'), token)).status,
    ).toBe(200);
    expect(
      (
        await s.request(
          '/calendar/v3/calendars/alex-work/events',
          'POST',
          timed('write-id'),
          token,
        )
      ).status,
    ).toBe(200);
    await quotaError(
      await s.request(events, 'POST', timed('blocked'), token),
      403,
      'rateLimitExceeded',
      'Rate Limit Exceeded',
    );
    await quotaError(
      await s.request(
        `${events}/watch`,
        'POST',
        {
          id: 'channel',
          type: 'web_hook',
          address: 'http://127.0.0.1:5555/hook',
        },
        token,
      ),
      403,
      'rateLimitExceeded',
      'Rate Limit Exceeded',
    );
    expect(
      (
        await s.request(
          '/calendar/v3/calendars/alex-personal/events',
          'POST',
          timed('other-calendar'),
          token,
        )
      ).status,
    ).toBe(200);
    const saved = await (
      await s.request('/__calendarpit/calendars/alex-work/events')
    ).json();
    const ids = saved.items.map((event: { id: string }) => event.id);
    expect(ids).toContain('write-primary');
    expect(ids).toContain('write-id');
    expect(ids).not.toContain('blocked');
    await s.app.drain();
  });

  test('strict project quota is 429 and follows quotaUser across users', async () => {
    const s = setup({ rateLimitMode: 'strict' });
    const { access_token: token } = await s.token();
    for (let i = 0; i < 12; i++) {
      const response = await s.request(
        `${list}?quotaUser=user-${i}`,
        'GET',
        undefined,
        token,
      );
      expect(response.status).toBe(200);
    }
    await quotaError(
      await s.request(`${list}?quotaUser=user-12`, 'GET', undefined, token),
      429,
      'rateLimitExceeded',
      'Rate Limit Exceeded',
    );
  });

  test('x-goog-quota-user selects the per-user bucket and overlong values do not', async () => {
    const s = setup({ rateLimitMode: 'strict' });
    const { access_token: token } = await s.token();
    for (let i = 0; i < 4; i++) {
      const response = await s.request(list, 'GET', undefined, token, {
        'x-goog-quota-user': 'service-user',
      });
      expect(response.status).toBe(200);
    }
    await quotaError(
      await s.request(list, 'GET', undefined, token, {
        'x-goog-quota-user': 'service-user',
      }),
      403,
      'userRateLimitExceeded',
      'User Rate Limit Exceeded',
    );
    const fresh = setup({ rateLimitMode: 'strict' });
    const { access_token: other } = await fresh.token();
    for (let i = 0; i < 4; i++) {
      const response = await fresh.request(
        `${list}?quotaUser=${'u'.repeat(41)}`,
        'GET',
        undefined,
        other,
      );
      expect(response.status).toBe(200);
    }
    await quotaError(
      await fresh.request(
        `${list}?quotaUser=${'v'.repeat(41)}`,
        'GET',
        undefined,
        other,
      ),
      403,
      'userRateLimitExceeded',
      'User Rate Limit Exceeded',
    );
  });

  test('strict daily ceiling is quotaExceeded after the minute windows move', async () => {
    let now = 1_700_000_000_000;
    const s = setup({ rateLimitMode: 'strict', now: () => now });
    const { access_token: token } = await s.token();
    const accept = async (count: number, start: number) => {
      for (let i = 0; i < count; i++) {
        const response = await s.request(
          `${list}?quotaUser=day-${start + i}`,
          'GET',
          undefined,
          token,
        );
        expect(response.status).toBe(200);
      }
    };
    await accept(12, 0);
    now += 60_000;
    await accept(8, 12);
    await quotaError(
      await s.request(`${list}?quotaUser=day-20`, 'GET', undefined, token),
      403,
      'quotaExceeded',
      'Calendar usage limits exceeded.',
    );
  });

  test('a full minute window accepts again after 60 seconds', async () => {
    let now = 1_700_000_000_000;
    const s = setup({ rateLimitMode: 'strict', now: () => now });
    const { access_token: token } = await s.token();
    for (let i = 0; i < 4; i++)
      expect((await s.request(list, 'GET', undefined, token)).status).toBe(200);
    expect((await s.request(list, 'GET', undefined, token)).status).toBe(403);
    now += 60_000;
    expect((await s.request(list, 'GET', undefined, token)).status).toBe(200);
  });

  test('anonymous requests share one user bucket', async () => {
    const s = setup({ rateLimitMode: 'strict' });
    for (let i = 0; i < 4; i++)
      expect((await s.request(list)).status).toBe(401);
    await quotaError(
      await s.request(list),
      403,
      'userRateLimitExceeded',
      'User Rate Limit Exceeded',
    );
  });

  test('changing the mode clears counters and reset keeps the mode', async () => {
    const s = setup();
    const { access_token: token } = await s.token();
    const strict = await s.request('/__calendarpit/rate-limit', 'PUT', {
      mode: 'strict',
    });
    expect(strict.status).toBe(200);
    expect((await strict.json()).rateLimitMode).toBe('strict');
    for (let i = 0; i < 4; i++)
      expect((await s.request(list, 'GET', undefined, token)).status).toBe(200);
    expect((await s.request(list, 'GET', undefined, token)).status).toBe(403);
    const off = await s.request('/__calendarpit/rate-limit', 'PUT', {
      mode: 'off',
    });
    expect((await off.json()).rateLimitMode).toBe('off');
    expect((await s.request(list, 'GET', undefined, token)).status).toBe(200);
    await s.request('/__calendarpit/rate-limit', 'PUT', { mode: 'strict' });
    for (let i = 0; i < 4; i++)
      expect((await s.request(list, 'GET', undefined, token)).status).toBe(200);
    expect((await s.request(list, 'GET', undefined, token)).status).toBe(403);
    const reset = await s.request('/__calendarpit/reset', 'POST', {});
    expect((await reset.json()).rateLimitMode).toBe('strict');
    const { access_token: next } = await s.token();
    expect((await s.request(list, 'GET', undefined, next)).status).toBe(200);
    const invalid = await s.request('/__calendarpit/rate-limit', 'PUT', {
      mode: 'high',
    });
    expect(invalid.status).toBe(400);
    const extra = await s.request('/__calendarpit/rate-limit', 'PUT', {
      mode: 'off',
      limit: 1,
    });
    expect(extra.status).toBe(400);
    expect(
      (await (await s.request('/__calendarpit/state')).json()).rateLimitMode,
    ).toBe('strict');
  });

  test('one workspace does not consume another workspace quota', async () => {
    const limited = setup({ rateLimitMode: 'strict' });
    const open = setup();
    for (let i = 0; i < 4; i++)
      expect((await limited.request(list)).status).toBe(401);
    expect((await limited.request(list)).status).toBe(403);
    const { access_token: token } = await open.token();
    for (let i = 0; i < 5; i++)
      expect((await open.request(list, 'GET', undefined, token)).status).toBe(
        200,
      );
  });

  test('prod allows the published per-user minute and then returns userRateLimitExceeded', async () => {
    const s = setup({ rateLimitMode: 'prod' });
    const { access_token: token } = await s.token();
    for (let i = 0; i < 600; i++) {
      const response = await s.request(list, 'GET', undefined, token);
      expect(response.status).toBe(200);
      await response.body?.cancel();
    }
    await quotaError(
      await s.request(list, 'GET', undefined, token),
      403,
      'userRateLimitExceeded',
      'User Rate Limit Exceeded',
    );
  }, 60_000);

  test('prod returns 403 rateLimitExceeded on the 61st write to one calendar', async () => {
    const s = setup({ rateLimitMode: 'prod' });
    const { access_token: token } = await s.token();
    for (let i = 0; i < 60; i++) {
      const response = await s.request(
        events,
        'POST',
        timed(`prod-${i}`),
        token,
      );
      expect(response.status).toBe(200);
      await response.body?.cancel();
    }
    await quotaError(
      await s.request(events, 'POST', timed('prod-60'), token),
      403,
      'rateLimitExceeded',
      'Rate Limit Exceeded',
    );
  }, 60_000);
});
