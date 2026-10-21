import { ApiError, fail } from '../../shared/errors';
import type { Workspace } from '../../workspace/workspace';
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
  project: number[];
  users: Map<string, number[]>;
  calendars: Map<string, number[]>;
};

const usageLogs = new WeakMap<Workspace, UsageLog>();

/** Shared bucket for requests with no token and no `quotaUser`. */
const anonymousQuotaUser = '\u0000anonymous';

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
 * @throws {@link ApiError} 400 when `mode` is not `off`, `prod`, or `strict`.
 */
export function setRateLimitMode(workspace: Workspace, mode: unknown) {
  if (!isRateLimitMode(mode)) fail('mode must be off, prod, or strict.');
  if (workspace.rateLimitMode === mode) return;
  workspace.rateLimitMode = mode;
  clearRateLimitUsage(workspace);
}

/**
 * Counts one `/calendar/v3` request and rejects it when the active mode's
 * budget is already full.
 *
 * OAuth and the management API are not counted. The quota user is
 * `quotaUser` or `x-goog-quota-user` when that value is 1–40 characters,
 * otherwise the access token's user, otherwise one shared anonymous bucket.
 * `quotaUser` overrides the token user, as Google does for service accounts.
 * A rejected request is not counted. The response uses Google's `usageLimits`
 * domain and a `Retry-After` value for the window that blocked it.
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
  const now = workspace.now();
  const log = usageLog(workspace);
  const userKey = quotaUser(workspace, request, url);
  const calendarId = calendarWriteId(url.pathname, request.method);
  const calendarKey = calendarId
    ? writeKey(workspace, calendarId, userKey)
    : undefined;
  const projectWindow =
    rateLimitBudgets[mode].perDayPerProject === Infinity
      ? rateLimitMinuteMs
      : rateLimitDayMs;
  retain(log.project, now, projectWindow);
  const userStamps = prepare(log.users, userKey, now, rateLimitMinuteMs);
  const calendarStamps = calendarKey
    ? prepare(log.calendars, calendarKey, now, rateLimitMinuteMs)
    : undefined;
  const rejection = rejectRateLimit(mode, {
    projectInMinute: countSince(log.project, now, rateLimitMinuteMs),
    userInMinute: userStamps.length,
    calendarWritesInMinute: calendarStamps?.length ?? 0,
    projectInDay: countSince(log.project, now, rateLimitDayMs),
    calendarWrite: calendarKey !== undefined,
  });
  if (rejection) {
    remember(log.users, userKey, userStamps);
    if (calendarKey && calendarStamps)
      remember(log.calendars, calendarKey, calendarStamps);
    const stamps = stampsFor(rejection.bucket, log, userStamps, calendarStamps);
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
    calendars: new Map(),
  };
  usageLogs.set(workspace, created);
  return created;
}

/**
 * Google's `quotaUser` is an arbitrary string of at most 40 characters, used
 * only for quota accounting. Longer or empty values are ignored.
 */
function quotaUser(workspace: Workspace, request: Request, url: URL) {
  const explicit =
    acceptedQuotaUser(url.searchParams.get('quotaUser')) ??
    acceptedQuotaUser(request.headers.get('x-goog-quota-user'));
  if (explicit) return explicit;
  return authenticatedUserId(workspace, request) ?? anonymousQuotaUser;
}

function acceptedQuotaUser(value: string | null) {
  if (!value || value.length > 40) return undefined;
  return value;
}

/**
 * The user id behind a still-valid bearer token.
 *
 * This does not call `authenticate`: a missing token must still be counted,
 * and authentication errors belong to the route that handles the request.
 */
function authenticatedUserId(workspace: Workspace, request: Request) {
  const token = request.headers
    .get('authorization')
    ?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) return undefined;
  const saved = workspace.access.get(token);
  if (!saved || saved.expires <= workspace.now()) return undefined;
  const grant = workspace.grants.get(saved.grantId);
  if (!grant || grant.revoked) return undefined;
  return grant.userId;
}

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

function countSince(stamps: number[], now: number, windowMs: number) {
  const cutoff = now - windowMs;
  let count = 0;
  for (const at of stamps) if (at > cutoff) count++;
  return count;
}

function stampsFor(
  bucket: RateLimitBucket,
  log: UsageLog,
  userStamps: number[],
  calendarStamps: number[] | undefined,
) {
  if (bucket === 'user') return userStamps;
  if (bucket === 'calendar') return calendarStamps ?? [];
  return log.project;
}

function retryAfterSeconds(stamps: number[], now: number, windowMs: number) {
  let oldest = Infinity;
  const cutoff = now - windowMs;
  for (const at of stamps) if (at > cutoff && at < oldest) oldest = at;
  if (!Number.isFinite(oldest)) return 1;
  return Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
}
