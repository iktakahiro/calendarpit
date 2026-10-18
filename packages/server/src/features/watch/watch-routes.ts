import { fail } from '../../shared/errors';
import { fields, string } from '../../shared/validation';
import { checkQuery, parseJsonBody } from '../../http/requests';
import { json, noContent } from '../../http/responses';
import type { Route } from '../../http/router';
import { findCalendar } from '../calendars/calendar-operations';
import { authenticate } from '../oauth/oauth-operations';
import { readCalendarList, readEvents, stopChannels } from '../oauth/scopes';
import { openChannel, stopChannel } from './channel-operations';
import { drainDeliveries } from './delivery-operations';

function channelResponse(channel: {
  id: string;
  resourceId: string;
  resourceUri: string;
  expiration: number;
  token?: string;
}) {
  return json({
    kind: 'api#channel',
    id: channel.id,
    resourceId: channel.resourceId,
    resourceUri: channel.resourceUri,
    expiration: String(channel.expiration),
    ...(channel.token ? { token: channel.token } : {}),
  });
}

/**
 * Google `events.watch`, `calendarList.watch`, and `channels.stop`. Only
 * `web_hook` channels are supported. A new channel immediately receives a
 * `sync` message. `params.ttl` is rejected; send `expiration` instead.
 */
export const watchGoogleRoutes: Route[] = [
  {
    pattern: /^\/calendar\/v3\/calendars\/([^/]+)\/events\/watch$/,
    handle({ workspace, request, url, body }, [calendarId]) {
      // Other methods on this path address an event with the ID `watch`.
      if (request.method !== 'POST') return;
      const grant = authenticate(
        workspace,
        request.headers.get('authorization'),
        readEvents,
      );
      const c = findCalendar(workspace, calendarId!, grant.userId);
      checkQuery(url, []);
      const channel = openChannel(workspace, grant.id, parseJsonBody(body), {
        calendarId: c.id,
        resourceId: `calendar-${c.id}`,
        resourceUri: new URL(
          `/calendar/v3/calendars/${encodeURIComponent(c.id)}/events`,
          url,
        ).href,
      });
      return channelResponse(channel);
    },
  },
  {
    pattern: /^\/calendar\/v3\/users\/me\/calendarList\/watch$/,
    handle({ workspace, request, url, body }) {
      if (request.method !== 'POST') return;
      const grant = authenticate(
        workspace,
        request.headers.get('authorization'),
        readCalendarList,
      );
      checkQuery(url, []);
      const channel = openChannel(workspace, grant.id, parseJsonBody(body), {
        userId: grant.userId,
        resourceId: `calendarList-${grant.userId}`,
        resourceUri: new URL('/calendar/v3/users/me/calendarList', url).href,
      });
      return channelResponse(channel);
    },
  },
  {
    pattern: /^\/calendar\/v3\/channels\/stop$/,
    handle({ workspace, request, body }) {
      if (request.method !== 'POST') return;
      const grant = authenticate(
        workspace,
        request.headers.get('authorization'),
        stopChannels,
      );
      const d = parseJsonBody(body);
      fields(d, ['id', 'resourceId']);
      const c = workspace.channels.get(string(d.id, 'id'));
      if (!c || c.resourceId !== d.resourceId || c.grantId !== grant.id)
        fail('Channel not found.', 404, 'notFound');
      stopChannel(workspace, c);
      return noContent();
    },
  },
];

/** Management endpoint that waits for queued deliveries, for tests. */
export const watchManagementRoutes: Route[] = [
  {
    pattern: /^\/__calendarpit\/deliveries\/drain$/,
    async handle({ workspace, request }) {
      if (request.method !== 'POST') return;
      await drainDeliveries(workspace);
      return json(workspace.deliveries);
    },
  },
];
