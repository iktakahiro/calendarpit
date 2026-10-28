/** Targets that consume queued failures independently. */
export type FaultTarget = 'token' | 'calendar';

/** Available fault identifiers for each target. */
export const faultKinds = {
  token: ['admin_policy_enforced', 'invalid_grant'],
  calendar: [
    'expired_access_token',
    'invalid_credentials',
    'forbidden',
    'insufficientPermissions',
    'rateLimitExceeded',
    'backendError',
    'serviceUnavailable',
  ],
} as const;

/** A pending fault and its remaining uses. */
export type Fault = { target: FaultTarget; kind: string; times: number };

/** HTTP status returned by each simulated failure. */
export const faultStatuses: Record<string, number> = {
  admin_policy_enforced: 400,
  invalid_grant: 400,
  expired_access_token: 401,
  invalid_credentials: 401,
  forbidden: 403,
  insufficientPermissions: 403,
  rateLimitExceeded: 429,
  backendError: 500,
  serviceUnavailable: 503,
};

/** Parses an optional count, returning undefined for an invalid value. */
export function faultCount(value: string): number | undefined {
  if (!value.trim()) return 1;
  if (!/^\d+$/.test(value.trim())) return undefined;
  const count = Number(value);
  return Number.isInteger(count) && count >= 1 && count <= 100
    ? count
    : undefined;
}
