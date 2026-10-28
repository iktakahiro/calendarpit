import { ApiError, fail } from '../../shared/errors';
import type { Workspace } from '../../workspace/workspace';
import { validBearerGrant } from '../oauth/access-token-operations';
import {
  calendarWriteId,
  isRateLimitMode,
  rateLimitBudgets,
  rateLimitDayMs,
  rateLimitMinuteMs,
  rejectRateLimit,
  type RateLimitBucket,
} from './rate-limit';

/**
 * Accepted Calendar API timestamps for one workspace. Not saved: a restart
 * starts from an empty window, which matches a new local process.
 */
type UsageLog = {
  /** Sliding minute for the whole workspace. */
  project: number[];
  /** Sliding minute per quota user. */
  users: Map<string, number[]>;
  /** Sliding day per token user, kept only when a daily budget applies. */
  days: Map<string, number[]>;
  /** Sliding minute of writes per calendar id. */
  calendars: Map<string, number[]>;
};

const usageLogs = new WeakMap<Workspace, UsageLog>();

/**
 * Drops the in-memory quota windows for `workspace`.
 *
 * The selected mode is left as it is. Reset, fixture load, and a mode change
 * call this so the next scenario is not still over budget.
 */
export function clearRateLimitUsage(workspace: Workspace) {
  usageLogs.delete(workspace);
}

/**
 * Saves `mode` and clears usage when it changes.
 *
 * @throws {@link ApiError} 400 when `mode` is not `off`, `production`, or
 * `error-test`.
 */
export function setRateLimitMode(workspace: Workspace, mode: unknown) {
  if (!isRateLimitMode(mode))
    fail('mode must be off, production, or error-test.');
  if (workspace.rateLimitMode === mode) return;
  workspace.rateLimitMode = mode;
  clearRateLimitUsage(workspace);
}

/**
 * Counts one `/calendar/v3` request and rejects it when the active mode's
 * budget is already full.
 *
 * OAuth and the management API are not counted. A request without a valid
 * access token (missing, unknown, expired, or revoked) is not counted either
 * and is left to the route, which returns its usual `401`. For an
 * authenticated request, the per-minute user bucket is `quotaUser` or
 * `x-goog-quota-user` when that value is 1–40 characters, otherwise the
 * token's user; `quotaUser` overrides the token user, as Google does for
 * service accounts. The daily bucket and `primary` always use the token's
 * user. A rejected request is not counted. The response uses Google's
 * `usageLimits` domain. Calendarpit also adds a `Retry-After` hint for the
 * window that blocked it; Google's documentation does not specify that
 * header, so clients should still back off exponentially.
 *
 * @throws {@link ApiError} 403 `userRateLimitExceeded`, 403 or 429
 * `rateLimitExceeded`, or 403 `quotaExceeded` when the request does not fit.
 */
export function enforceCalendarRateLimit(
  workspace: Workspace,
  request: Request,
  url: URL,
) {
  const mode = workspace.rateLimitMode;
  if (mode === 'off') return;
  const userId = validBearerGrant(
    workspace,
    request.headers.get('authorization'),
  )?.userId;
  if (!userId) return;
  const now = workspace.now();
  const log = usageLog(workspace);
  const userKey = quotaUser(request, url) ?? userId;
  const calendarId = calendarWriteId(url.pathname, request.method);
  const calendarKey = calendarId
    ? writeKey(workspace, calendarId, userId)
    : undefined;
  const daily = rateLimitBudgets[mode].perDayPerUser !== Infinity;
  retain(log.project, now, rateLimitMinuteMs);
  const userStamps = prepare(log.users, userKey, now, rateLimitMinuteMs);
  const dayStamps = daily
    ? prepare(log.days, userId, now, rateLimitDayMs)
    : undefined;
  const calendarStamps = calendarKey
    ? prepare(log.calendars, calendarKey, now, rateLimitMinuteMs)
    : undefined;
  const rejection = rejectRateLimit(mode, {
    projectInMinute: log.project.length,
    userInMinute: userStamps.length,
    calendarWritesInMinute: calendarStamps?.length ?? 0,
    userInDay: dayStamps?.length ?? 0,
    calendarWrite: calendarKey !== undefined,
  });
  if (rejection) {
    remember(log.users, userKey, userStamps);
    if (dayStamps) remember(log.days, userId, dayStamps);
    if (calendarKey && calendarStamps)
      remember(log.calendars, calendarKey, calendarStamps);
    const stamps = stampsFor(rejection.bucket, log, {
      user: userStamps,
      day: dayStamps,
      calendar: calendarStamps,
    });
    throw new ApiError(
      rejection.status,
      rejection.reason,
      rejection.message,
      'usageLimits',
      {
        'Retry-After': String(
          retryAfterSeconds(stamps, now, rejection.windowMs),
        ),
      },
    );
  }
  log.project.push(now);
  userStamps.push(now);
  log.users.set(userKey, userStamps);
  if (dayStamps) {
    dayStamps.push(now);
    log.days.set(userId, dayStamps);
  }
  if (calendarKey && calendarStamps) {
    calendarStamps.push(now);
    log.calendars.set(calendarKey, calendarStamps);
  }
}

function usageLog(workspace: Workspace): UsageLog {
  const existing = usageLogs.get(workspace);
  if (existing) return existing;
  const created: UsageLog = {
    project: [],
    users: new Map(),
    days: new Map(),
    calendars: new Map(),
  };
  usageLogs.set(workspace, created);
  return created;
}

/**
 * Google's `quotaUser` is an arbitrary string of at most 40 characters, used
 * only for quota accounting. Longer or empty values are ignored.
 */
function quotaUser(request: Request, url: URL) {
  return (
    acceptedQuotaUser(url.searchParams.get('quotaUser')) ??
    acceptedQuotaUser(request.headers.get('x-goog-quota-user'))
  );
}

function acceptedQuotaUser(value: string | null) {
  if (!value || value.length > 40) return undefined;
  return value;
}

/** Resolves `primary` to the token user's primary calendar id. */
function writeKey(workspace: Workspace, calendarId: string, userId: string) {
  if (calendarId !== 'primary') return calendarId;
  const owned = workspace.data.calendars.find(
    (calendar) => calendar.primary && calendar.userId === userId,
  );
  return owned?.id ?? `primary:${userId}`;
}

function prepare(
  buckets: Map<string, number[]>,
  key: string,
  now: number,
  windowMs: number,
) {
  const stamps = buckets.get(key) ?? [];
  retain(stamps, now, windowMs);
  return stamps;
}

/** Keeps a bucket only while it still holds timestamps inside the window. */
function remember(
  buckets: Map<string, number[]>,
  key: string,
  stamps: number[],
) {
  if (stamps.length === 0) buckets.delete(key);
  else buckets.set(key, stamps);
}

function retain(stamps: number[], now: number, windowMs: number) {
  const cutoff = now - windowMs;
  let write = 0;
  for (const at of stamps) if (at > cutoff) stamps[write++] = at;
  stamps.length = write;
}

function stampsFor(
  bucket: RateLimitBucket,
  log: UsageLog,
  stamps: { user: number[]; day?: number[]; calendar?: number[] },
) {
  if (bucket === 'user') return stamps.user;
  if (bucket === 'day') return stamps.day ?? [];
  if (bucket === 'calendar') return stamps.calendar ?? [];
  return log.project;
}

function retryAfterSeconds(stamps: number[], now: number, windowMs: number) {
  let oldest = Infinity;
  const cutoff = now - windowMs;
  for (const at of stamps) if (at > cutoff && at < oldest) oldest = at;
  if (!Number.isFinite(oldest)) return 1;
  return Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
}
