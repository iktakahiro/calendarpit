import type { RateLimitMode } from '../../model/rate-limit';

/** Sliding window for the per-minute Calendar API quotas. */
export const rateLimitMinuteMs = 60_000;

/** Sliding window for the `error-test` daily per-user ceiling. */
export const rateLimitDayMs = 86_400_000;

/**
 * Request budgets for one {@link RateLimitMode}.
 *
 * Counts are the number of Calendar API requests already accepted in the
 * window. The next request is rejected when a count reaches the budget.
 * `Infinity` means that ceiling is not enforced.
 */
export type RateLimitBudgets = {
  /** Requests per sliding minute for the whole workspace, as one Cloud project. */
  perMinutePerProject: number;
  /**
   * Requests per sliding minute for one quota user: `quotaUser` or
   * `x-goog-quota-user` when sent, otherwise the access token's user.
   */
  perMinutePerUser: number;
  /** Mutating requests per sliding minute against one calendar. */
  writesPerMinutePerCalendar: number;
  /**
   * Requests per sliding day for one Google user, the access token's user.
   * `quotaUser` does not change this bucket, because Google's Calendar usage
   * limits apply to the Google user.
   */
  perDayPerUser: number;
};

/**
 * Budgets for each mode.
 *
 * `production` roughly matches the Calendar API quotas published for Cloud
 * projects created on or after 1 May 2026: 10,000 requests per minute per
 * project and 600 per minute per user per project, both on a sliding minute
 * (https://developers.google.com/workspace/calendar/api/guides/quota).
 * The same page's 1,000,000 requests per day is a billing threshold, not a
 * rejection, so `production` does not fail at that number. Google also says
 * writes to one calendar in quick succession can be limited, without a
 * published figure. `production` uses an estimated 60 writes per minute per
 * calendar for that operational limit. `error-test` is intentionally very low
 * so local tests can reach every documented quota error quickly. Its daily
 * ceiling stands in for Google's per-user Calendar usage limits, which Google
 * reports as `403 quotaExceeded`.
 */
export const rateLimitBudgets: Record<RateLimitMode, RateLimitBudgets> = {
  off: {
    perMinutePerProject: Infinity,
    perMinutePerUser: Infinity,
    writesPerMinutePerCalendar: Infinity,
    perDayPerUser: Infinity,
  },
  production: {
    perMinutePerProject: 10_000,
    perMinutePerUser: 600,
    writesPerMinutePerCalendar: 60,
    perDayPerUser: Infinity,
  },
  'error-test': {
    perMinutePerProject: 12,
    perMinutePerUser: 4,
    writesPerMinutePerCalendar: 2,
    perDayPerUser: 20,
  },
};

/** Which counter a rejection came from, for the `Retry-After` hint. */
export type RateLimitBucket = 'day' | 'calendar' | 'user' | 'project';

/**
 * A Google Calendar quota error.
 *
 * Reasons and status codes follow
 * https://developers.google.com/workspace/calendar/api/guides/errors:
 * `userRateLimitExceeded` is 403, per-calendar `rateLimitExceeded` is 403,
 * a short-interval `rateLimitExceeded` is 429, and `quotaExceeded` (the
 * per-user Calendar usage limits) is 403.
 */
export type RateLimitRejection = {
  status: 403 | 429;
  reason: 'userRateLimitExceeded' | 'rateLimitExceeded' | 'quotaExceeded';
  message: string;
  /**
   * Window that has to move before this request would be accepted.
   * Calendarpit uses it for a `Retry-After` hint; Google does not document
   * that header for these errors.
   */
  windowMs: number;
  bucket: RateLimitBucket;
};

/** Accepted usage the next request would add to. */
export type RateLimitUsage = {
  projectInMinute: number;
  userInMinute: number;
  calendarWritesInMinute: number;
  /** Requests the token's user made in the sliding day. */
  userInDay: number;
  /** Whether this request mutates one calendar. */
  calendarWrite: boolean;
};

const userLimit: RateLimitRejection = {
  status: 403,
  reason: 'userRateLimitExceeded',
  message: 'User Rate Limit Exceeded',
  windowMs: rateLimitMinuteMs,
  bucket: 'user',
};

const projectLimit: RateLimitRejection = {
  status: 429,
  reason: 'rateLimitExceeded',
  message: 'Rate Limit Exceeded',
  windowMs: rateLimitMinuteMs,
  bucket: 'project',
};

const calendarLimit: RateLimitRejection = {
  status: 403,
  reason: 'rateLimitExceeded',
  message: 'Rate Limit Exceeded',
  windowMs: rateLimitMinuteMs,
  bucket: 'calendar',
};

const dailyLimit: RateLimitRejection = {
  status: 403,
  reason: 'quotaExceeded',
  message: 'Calendar usage limits exceeded.',
  windowMs: rateLimitDayMs,
  bucket: 'day',
};

/**
 * Decides whether one more Calendar API request exceeds `mode`.
 *
 * The per-user daily limit is checked first, then per-calendar writes, then
 * the per-user minute quota, then the project minute quota. The first ceiling wins, which
 * matches Google's separate reasons for those limits.
 *
 * @returns The Google error to return, or `undefined` when the request fits.
 */
export function rejectRateLimit(
  mode: RateLimitMode,
  usage: RateLimitUsage,
): RateLimitRejection | undefined {
  const budgets = rateLimitBudgets[mode];
  if (usage.userInDay >= budgets.perDayPerUser) return dailyLimit;
  if (
    usage.calendarWrite &&
    usage.calendarWritesInMinute >= budgets.writesPerMinutePerCalendar
  )
    return calendarLimit;
  if (usage.userInMinute >= budgets.perMinutePerUser) return userLimit;
  if (usage.projectInMinute >= budgets.perMinutePerProject) return projectLimit;
  return undefined;
}

/**
 * Reads a rate-limit mode from a CLI flag or environment variable.
 *
 * @returns `undefined` when `value` is omitted, so the caller keeps the mode
 * saved in the workspace.
 * @throws Error when `value` is present but not `off`, `production`, or `error-test`.
 */
export function parseRateLimitMode(
  value: string | undefined,
): RateLimitMode | undefined {
  if (value === undefined) return undefined;
  const mode = value.trim();
  if (isRateLimitMode(mode)) return mode;
  throw new Error('Rate limit mode must be off, production, or error-test.');
}

/**
 * Whether `value` is a saved or requested {@link RateLimitMode}.
 *
 * @returns `true` for `off`, `production`, and `error-test` only.
 */
export function isRateLimitMode(value: unknown): value is RateLimitMode {
  return value === 'off' || value === 'production' || value === 'error-test';
}

/**
 * Calendar id of a mutating `/calendar/v3/calendars/{id}` request.
 *
 * Reads, `freeBusy`, and `calendarList` are not per-calendar writes. `primary`
 * is returned as the literal path segment; the caller resolves it.
 *
 * @returns The decoded calendar id, or `undefined` when this request is not a
 * write to one calendar. Invalid percent-encoding yields `undefined`; routing
 * reports that error itself.
 */
export function calendarWriteId(
  pathname: string,
  method: string,
): string | undefined {
  if (
    method !== 'POST' &&
    method !== 'PUT' &&
    method !== 'PATCH' &&
    method !== 'DELETE'
  )
    return undefined;
  const match = /^\/calendar\/v3\/calendars\/([^/]+)(?:\/|$)/.exec(pathname);
  if (!match?.[1]) return undefined;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return undefined;
  }
}
