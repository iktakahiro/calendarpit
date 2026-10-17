import type { Channel, SavedChannel } from '../../model/watch';
import type { Workspace } from '../../workspace/workspace';
import { callbackUrl } from './callback-url';
import { enqueueDelivery } from './delivery-operations';

/** Stops a channel and aborts its in-flight deliveries. */
export function stopChannel(workspace: Workspace, channel: Channel) {
  channel.controller.abort();
  workspace.channels.delete(channel.id);
}

/** Stops channels that expired or whose grant was revoked. */
export function expireChannels(workspace: Workspace) {
  for (const c of workspace.channels.values())
    if (
      c.expiration <= workspace.now() ||
      workspace.grants.get(c.grantId)?.revoked
    )
      stopChannel(workspace, c);
}

/** Queues an `exists` notification on every channel watching a calendar. */
export function notifyCalendar(workspace: Workspace, calendarId: string) {
  expireChannels(workspace);
  for (const c of workspace.channels.values())
    if (c.calendarId === calendarId) enqueueDelivery(workspace, c, 'exists');
}

/**
 * Whether a saved channel may resume after a restart: it must be unexpired,
 * its grant must still be active, and its callback must pass the current host
 * allowlist.
 */
export function canResumeChannel(
  channel: SavedChannel,
  workspace: Workspace,
): boolean {
  const grant = workspace.grants.get(channel.grantId);
  if (channel.expiration <= workspace.now() || !grant || grant.revoked)
    return false;
  try {
    callbackUrl(channel.address, workspace.options.allowedWatchHosts);
    return true;
  } catch {
    return false;
  }
}
