import { clearFaults } from '../faults/fault-operations';
import type { Workspace } from '../../workspace/workspace';
import { clearRateLimitUsage } from '../quota/rate-limit-operations';
import { stopChannel } from '../watch/channel-operations';
import { parseFixture } from './fixture';

/**
 * Clears everything except calendar data and the startup fixture: grants,
 * tokens, codes, consents, history, sync and page tokens, tombstones,
 * notifications, calendar-list settings, deliveries, and channels. The saved
 * rate-limit mode stays; only its in-memory counters are cleared.
 */
function clearRuntime(workspace: Workspace) {
  clearRateLimitUsage(workspace);
  clearFaults(workspace);
  for (const channel of workspace.channels.values())
    stopChannel(workspace, channel);
  workspace.grants.clear();
  workspace.access.clear();
  workspace.refresh.clear();
  workspace.codes.clear();
  workspace.consents.clear();
  workspace.history = [];
  workspace.syncTokens.clear();
  workspace.eventPages.clear();
  workspace.deletedCalendars = [];
  workspace.calendarListEntries = [];
  workspace.notifications = [];
  workspace.deliveries = [];
  workspace.touch();
}

/**
 * Restores the startup fixture and clears all runtime state, so a test run
 * starts from a known baseline. Event IDs and metadata match the baseline.
 */
export function resetWorkspace(workspace: Workspace) {
  clearRuntime(workspace);
  workspace.data = structuredClone(workspace.startup);
  workspace.persist();
}

/**
 * Replaces the calendar data with a new fixture and clears runtime state. The
 * reset baseline stays the startup fixture.
 *
 * @throws {@link ApiError} 400 when the fixture is invalid. Nothing changes in
 * that case.
 */
export function loadFixture(workspace: Workspace, value: unknown) {
  const data = parseFixture(value, workspace.now());
  clearRuntime(workspace);
  workspace.data = data;
  workspace.persist();
}
