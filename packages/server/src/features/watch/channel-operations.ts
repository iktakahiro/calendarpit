import { fail } from '../../shared/errors';
import { fields, string } from '../../shared/validation';
import type { Channel, SavedChannel } from '../../model/watch';
import type { Workspace } from '../../workspace/workspace';
import { callbackUrl } from './callback-url';
import { enqueueDelivery } from './delivery-operations';

/** Channels default to one day and are capped at seven days, like Google. */
const defaultChannelTtlMs = 86400000;
const maxChannelTtlMs = 604800000;

/** The resource an {@link openChannel} call subscribes to. */
export type WatchTarget = {
  /** Set for `events.watch`. */
  calendarId?: string;
  /** Set for `calendarList.watch`. */
  userId?: string;
  resourceId: string;
  resourceUri: string;
};

/**
 * Opens a `web_hook` channel and queues its initial `sync` notification.
 *
 * `params.ttl` is rejected; callers set `expiration` in Unix milliseconds.
 * Only `web_hook` is accepted. The channel id is unique across event and
 * calendar-list watches.
 *
 * @throws {@link ApiError} 400 for an invalid channel, or 409 `duplicate`
 * when the id is already in use.
 */
export function openChannel(
  workspace: Workspace,
  grantId: string,
  input: Record<string, unknown>,
  target: WatchTarget,
): Channel {
  fields(input, ['id', 'type', 'address', 'token', 'expiration']);
  const id = string(input.id, 'id');
  if (!/^[\w-]{1,64}$/.test(id)) fail('Invalid channel ID.');
  expireChannels(workspace);
  if (workspace.channels.has(id))
    fail('Duplicate channel ID.', 409, 'duplicate');
  if (input.type !== 'web_hook') fail('Only web_hook channels are supported.');
  const address = string(input.address, 'address');
  callbackUrl(address, workspace.options.allowedWatchHosts);
  const token =
    input.token === undefined ? undefined : string(input.token, 'token');
  if (token && (token.length > 256 || /[\r\n]/.test(token)))
    fail('Invalid channel token.');
  const expiration =
    input.expiration === undefined
      ? workspace.now() + defaultChannelTtlMs
      : Number(input.expiration);
  if (!Number.isSafeInteger(expiration) || expiration <= workspace.now())
    fail('Invalid expiration.');
  const channel: Channel = {
    id,
    grantId,
    calendarId: target.calendarId,
    userId: target.userId,
    resourceId: target.resourceId,
    resourceUri: target.resourceUri,
    address,
    token,
    expiration: Math.min(expiration, workspace.now() + maxChannelTtlMs),
    message: 0,
    controller: new AbortController(),
    tail: Promise.resolve(),
  };
  workspace.channels.set(id, channel);
  enqueueDelivery(workspace, channel, 'sync');
  return channel;
}

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

/** Queues an `exists` notification on every channel watching this user's list. */
export function notifyCalendarList(workspace: Workspace, userId: string) {
  expireChannels(workspace);
  for (const c of workspace.channels.values())
    if (c.userId === userId) enqueueDelivery(workspace, c, 'exists');
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
