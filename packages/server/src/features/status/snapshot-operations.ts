import type { Workspace } from '../../workspace/workspace';
import { publicClient } from '../oauth/oauth-client';
import { expireChannels } from '../watch/channel-operations';

/**
 * Returns the workspace state the admin UI renders, after stopping expired
 * channels. Client secrets and channel tokens are omitted or redacted.
 */
export function snapshot(workspace: Workspace) {
  expireChannels(workspace);
  return {
    storage: workspace.storage,
    users: workspace.data.users,
    calendars: workspace.data.calendars,
    events: workspace.data.events,
    clients: workspace.data.clients.map(publicClient),
    connections: [...workspace.grants.values()],
    channels: [...workspace.channels.values()].map(
      ({ controller: _controller, tail: _tail, token, ...c }) => ({
        ...c,
        ...(token ? { token: '[REDACTED]' } : {}),
      }),
    ),
    deliveries: workspace.deliveries,
    notifications: workspace.notifications,
    revision: workspace.revision,
  };
}

/** The `GET /__calendarpit/state` payload. */
export type Snapshot = ReturnType<typeof snapshot>;
