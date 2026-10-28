import { ApiError, fail } from '../../shared/errors';
import { fields, object } from '../../shared/validation';
import type { Workspace } from '../../workspace/workspace';

const kinds = {
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
type Fault = { target: 'token' | 'calendar'; kind: string; times: number };
const queues = new WeakMap<Workspace, Fault[]>();

/** Returns a copy of the pending, process-local fault queue. */
export function pendingFaults(workspace: Workspace): Fault[] {
  return structuredClone(queues.get(workspace) ?? []);
}

/** Removes all pending faults without changing saved data. */
export function clearFaults(workspace: Workspace) {
  queues.delete(workspace);
}

/** Appends a validated fault; counts are bounded to keep scenarios finite. */
export function queueFault(workspace: Workspace, value: unknown) {
  const data = object(value);
  fields(data, ['target', 'kind', 'times']);
  const target = data.target;
  if (target !== 'token' && target !== 'calendar')
    fail('Unknown fault target.');
  if (
    typeof data.kind !== 'string' ||
    !(kinds[target] as readonly string[]).includes(data.kind)
  )
    fail('Unknown fault kind.');
  const times = data.times ?? 1;
  if (
    typeof times !== 'number' ||
    !Number.isInteger(times) ||
    times < 1 ||
    times > 100
  )
    fail('times must be an integer from 1 to 100.');
  const queue = queues.get(workspace) ?? [];
  if (queue.length >= 100) fail('Too many pending faults.');
  queue.push({ target, kind: data.kind, times });
  queues.set(workspace, queue);
}

/** Consumes the first queued fault for a target, if one exists. */
export function consumeFault(
  workspace: Workspace,
  target: Fault['target'],
): string | undefined {
  const queue = queues.get(workspace);
  const index = queue?.findIndex((fault) => fault.target === target) ?? -1;
  if (!queue || index < 0) return undefined;
  const fault = queue[index]!;
  if (--fault.times === 0) queue.splice(index, 1);
  return fault.kind;
}

/** Rejects authenticated Calendar requests with the next queued Google-style error. */
export function injectCalendarFault(workspace: Workspace, request: Request) {
  const token = request.headers
    .get('authorization')
    ?.match(/^Bearer (\S+)$/i)?.[1];
  const access = token && workspace.access.get(token);
  const grant = access && workspace.grants.get(access.grantId);
  if (!access || access.expires <= workspace.now() || !grant || grant.revoked)
    return;
  const kind = consumeFault(workspace, 'calendar');
  if (!kind) return;
  const errors: Record<string, [number, string, string, string]> = {
    expired_access_token: [401, 'authError', 'Invalid Credentials', 'global'],
    invalid_credentials: [401, 'authError', 'Invalid Credentials', 'global'],
    forbidden: [403, 'forbidden', 'Forbidden', 'global'],
    insufficientPermissions: [
      403,
      'insufficientPermissions',
      'Insufficient Permission',
      'global',
    ],
    rateLimitExceeded: [
      429,
      'rateLimitExceeded',
      'Rate Limit Exceeded',
      'usageLimits',
    ],
    backendError: [500, 'backendError', 'Backend Error', 'global'],
    serviceUnavailable: [503, 'backendError', 'Service Unavailable', 'global'],
  };
  const [status, reason, message, domain] = errors[kind]!;
  throw new ApiError(status, reason, message, domain);
}
