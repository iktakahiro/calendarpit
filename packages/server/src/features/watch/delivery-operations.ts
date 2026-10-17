import type { Channel, Delivery } from '../../model/watch';
import { recordLimit, type Workspace } from '../../workspace/workspace';
import { callbackUrl } from './callback-url';

/** Attempts per notification, including the first. */
const maxAttempts = 3;
/** Timeout of one delivery attempt. */
const attemptTimeoutMs = 2000;
/** Default delay between attempts. */
const defaultRetryDelayMs = 100;
/** HTTP statuses Google treats as a successful delivery. */
const successStatuses = [200, 201, 202, 204];

/** Whether a channel may still deliver: open, unexpired, and authorized. */
function isActive(workspace: Workspace, channel: Channel) {
  return (
    !workspace.isClosed &&
    !channel.controller.signal.aborted &&
    channel.expiration > workspace.now() &&
    workspace.channels.get(channel.id) === channel &&
    !workspace.grants.get(channel.grantId)?.revoked
  );
}

/** Waits for the retry delay, ending early when the channel stops. */
function retryDelay(workspace: Workspace, channel: Channel) {
  return new Promise<void>((resolve) => {
    const done = () => {
      clearTimeout(timer);
      channel.controller.signal.removeEventListener('abort', done);
      resolve();
    };
    const timer = setTimeout(
      done,
      workspace.options.retryDelayMs ?? defaultRetryDelayMs,
    );
    channel.controller.signal.addEventListener('abort', done, { once: true });
  });
}

/** Sends one notification with Google's `X-Goog-*` headers. */
async function attempt(
  workspace: Workspace,
  channel: Channel,
  entry: Delivery,
) {
  const headers: Record<string, string> = {
    'X-Goog-Channel-ID': channel.id,
    'X-Goog-Resource-ID': channel.resourceId,
    'X-Goog-Resource-URI': channel.resourceUri,
    'X-Goog-Resource-State': entry.state,
    'X-Goog-Message-Number': String(entry.messageNumber),
    'X-Goog-Channel-Expiration': new Date(channel.expiration).toUTCString(),
  };
  if (channel.token) headers['X-Goog-Channel-Token'] = channel.token;
  const response = await (workspace.options.deliver ?? fetch)(
    // Recheck the allowlist on every attempt; the configuration may change.
    callbackUrl(channel.address, workspace.options.allowedWatchHosts),
    {
      method: 'POST',
      headers,
      body: '',
      redirect: 'manual',
      signal: AbortSignal.any([
        channel.controller.signal,
        AbortSignal.timeout(attemptTimeoutMs),
      ]),
    },
  );
  entry.httpStatus = response.status;
  await response.body?.cancel();
  return response.status;
}

/**
 * Queues a notification for a channel and delivers it in the background.
 *
 * Deliveries of one channel run in order. Each is tried up to three times and
 * recorded as `delivered`, `failed`, or `cancelled` when the channel stops,
 * expires, or loses its grant. Failures never record callback credentials.
 *
 * @param state - `sync` for the first message of a channel, `exists` after a
 * change.
 */
export function enqueueDelivery(
  workspace: Workspace,
  channel: Channel,
  state: 'sync' | 'exists',
) {
  const entry: Delivery = {
    id: crypto.randomUUID(),
    channelId: channel.id,
    state,
    messageNumber: ++channel.message,
    time: new Date(workspace.now()).toISOString(),
    attempts: 0,
    status: 'queued',
  };
  workspace.deliveries.push(entry);
  workspace.deliveries = workspace.deliveries.slice(-recordLimit);
  workspace.persist();
  const active = () => isActive(workspace, channel);
  const task = channel.tail
    .then(async () => {
      for (let i = 0; i < maxAttempts; i++) {
        if (!active()) {
          entry.status = 'cancelled';
          return;
        }
        entry.attempts++;
        try {
          const status = await attempt(workspace, channel, entry);
          if (!active()) {
            entry.status = 'cancelled';
            return;
          }
          if (successStatuses.includes(status)) {
            entry.status = 'delivered';
            return;
          }
        } catch {
          /* Failures are recorded without including callback credentials. */
        }
        if (i < maxAttempts - 1 && active())
          await retryDelay(workspace, channel);
      }
      entry.status = active() ? 'failed' : 'cancelled';
    })
    .catch(() => {
      entry.status = 'failed';
    });
  channel.tail = task;
  workspace.pending.add(task);
  void task.finally(() => {
    workspace.pending.delete(task);
    try {
      workspace.persist();
    } catch (error) {
      console.error('Failed to persist watch delivery:', error);
    }
  });
}

/** Resolves when every queued delivery has finished. */
export async function drainDeliveries(workspace: Workspace) {
  await Promise.all([...workspace.pending]);
}
