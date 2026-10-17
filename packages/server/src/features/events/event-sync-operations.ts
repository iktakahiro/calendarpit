import { fail } from '../../shared/errors';
import type { Calendar } from '../../model/directory';
import type { SyncState } from '../../model/sync';
import type { Workspace } from '../../workspace/workspace';

/** Sync tokens expire after seven days. */
const syncTokenTtlMs = 7 * 86400000;
/** At most this many sync tokens are kept; the oldest are dropped first. */
const maxSyncTokens = 100;

/**
 * Looks up the state behind a sync token for an incremental `events.list`.
 *
 * @throws {@link ApiError} 410 `fullSyncRequired` when the token is unknown,
 * expired, or belongs to another calendar or user, or 400 when the query
 * options differ from the initial sync.
 */
export function readSync(
  workspace: Workspace,
  token: string,
  calendar: Calendar,
  userId: string,
  singleEvents: boolean,
  timeZone: string,
): SyncState {
  const state = workspace.syncTokens.get(token);
  if (
    !state ||
    state.expires <= workspace.now() ||
    state.calendarId !== calendar.id ||
    state.userId !== userId
  )
    fail(
      'Sync token is invalid or expired. Perform a full synchronization.',
      410,
      'fullSyncRequired',
    );
  if (state.singleEvents !== singleEvents || state.timeZone !== timeZone)
    fail('Sync query options must match the initial synchronization.');
  return state;
}

/**
 * Issues a sync token that snapshots the calendar's current events. Expired
 * tokens are pruned first.
 *
 * @returns The new token.
 */
export function issueSync(
  workspace: Workspace,
  state: Omit<SyncState, 'events' | 'expires'>,
) {
  const token = crypto.randomUUID();
  for (const [key, value] of workspace.syncTokens)
    if (value.expires <= workspace.now()) workspace.syncTokens.delete(key);
  while (workspace.syncTokens.size >= maxSyncTokens)
    workspace.syncTokens.delete(workspace.syncTokens.keys().next().value!);
  workspace.syncTokens.set(token, {
    ...state,
    events: structuredClone(
      workspace.data.events.filter((e) => e.calendarId === state.calendarId),
    ),
    expires: workspace.now() + syncTokenTtlMs,
  });
  return token;
}
