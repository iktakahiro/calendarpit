import { describe, expect, test } from 'bun:test';
import {
  calendarWriteId,
  parseRateLimitMode,
  rateLimitBudgets,
  rejectRateLimit,
  type RateLimitUsage,
} from './rate-limit';

const under: RateLimitUsage = {
  projectInMinute: 0,
  userInMinute: 0,
  calendarWritesInMinute: 0,
  projectInDay: 0,
  calendarWrite: false,
};

describe('rejectRateLimit', () => {
  test('off accepts any volume', () => {
    expect(
      rejectRateLimit('off', {
        ...under,
        projectInMinute: 1_000_000,
        userInMinute: 1_000_000,
        calendarWritesInMinute: 1_000_000,
        projectInDay: 1_000_000,
        calendarWrite: true,
      }),
    ).toBeUndefined();
  });

  test('prod uses the published per-minute quotas and does not reject the daily billing threshold', () => {
    expect(rateLimitBudgets.prod).toEqual({
      perMinutePerProject: 10_000,
      perMinutePerUser: 600,
      writesPerMinutePerCalendar: 60,
      perDayPerProject: Infinity,
    });
    expect(
      rejectRateLimit('prod', { ...under, userInMinute: 599 }),
    ).toBeUndefined();
    expect(rejectRateLimit('prod', { ...under, userInMinute: 600 })).toEqual({
      status: 403,
      reason: 'userRateLimitExceeded',
      message: 'User Rate Limit Exceeded',
      windowMs: 60_000,
      bucket: 'user',
    });
    expect(
      rejectRateLimit('prod', { ...under, projectInMinute: 10_000 }),
    ).toMatchObject({
      status: 429,
      reason: 'rateLimitExceeded',
      bucket: 'project',
    });
    expect(
      rejectRateLimit('prod', {
        ...under,
        calendarWrite: true,
        calendarWritesInMinute: 60,
        userInMinute: 60,
      }),
    ).toMatchObject({
      status: 403,
      reason: 'rateLimitExceeded',
      bucket: 'calendar',
    });
    expect(
      rejectRateLimit('prod', { ...under, projectInDay: 1_000_000 }),
    ).toBeUndefined();
  });

  test('strict reports the ceiling that is already full', () => {
    expect(rateLimitBudgets.strict).toEqual({
      perMinutePerProject: 12,
      perMinutePerUser: 4,
      writesPerMinutePerCalendar: 2,
      perDayPerProject: 20,
    });
    expect(
      rejectRateLimit('strict', {
        ...under,
        projectInDay: 20,
        userInMinute: 0,
      }),
    ).toMatchObject({ status: 403, reason: 'quotaExceeded', bucket: 'day' });
    expect(
      rejectRateLimit('strict', {
        ...under,
        calendarWrite: true,
        calendarWritesInMinute: 2,
        userInMinute: 2,
      }),
    ).toMatchObject({
      status: 403,
      reason: 'rateLimitExceeded',
      bucket: 'calendar',
    });
    expect(
      rejectRateLimit('strict', { ...under, userInMinute: 4 }),
    ).toMatchObject({ status: 403, reason: 'userRateLimitExceeded' });
    expect(
      rejectRateLimit('strict', {
        ...under,
        projectInMinute: 12,
        userInMinute: 1,
      }),
    ).toMatchObject({
      status: 429,
      reason: 'rateLimitExceeded',
      bucket: 'project',
    });
  });
});

describe('parseRateLimitMode', () => {
  test('keeps a saved mode when the value is omitted', () => {
    expect(parseRateLimitMode(undefined)).toBeUndefined();
  });

  test.each(['off', 'prod', 'strict'] as const)('accepts %s', (mode) => {
    expect(parseRateLimitMode(` ${mode} `)).toBe(mode);
  });

  test.each(['', ' ', 'production', 'OFF', 'strictest'])(
    'rejects %j',
    (value) => {
      expect(() => parseRateLimitMode(value)).toThrow(
        'Rate limit mode must be off, prod, or strict.',
      );
    },
  );
});

describe('calendarWriteId', () => {
  test('reads the calendar from a mutating calendar path', () => {
    expect(
      calendarWriteId('/calendar/v3/calendars/primary/events', 'POST'),
    ).toBe('primary');
    expect(
      calendarWriteId('/calendar/v3/calendars/alex-work/events/watch', 'POST'),
    ).toBe('alex-work');
    expect(calendarWriteId('/calendar/v3/calendars/a%2Fb', 'DELETE')).toBe(
      'a/b',
    );
  });

  test('ignores reads and requests that are not aimed at one calendar', () => {
    expect(
      calendarWriteId('/calendar/v3/calendars/primary/events', 'GET'),
    ).toBeUndefined();
    expect(calendarWriteId('/calendar/v3/freeBusy', 'POST')).toBeUndefined();
    expect(
      calendarWriteId('/calendar/v3/users/me/calendarList/watch', 'POST'),
    ).toBeUndefined();
    expect(
      calendarWriteId('/calendar/v3/channels/stop', 'POST'),
    ).toBeUndefined();
  });
});
