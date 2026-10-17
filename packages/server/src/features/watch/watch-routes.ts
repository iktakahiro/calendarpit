import { fail } from '../../shared/errors';
import { fields, string } from '../../shared/validation';
import type { Channel } from '../../model/watch';
import { checkQuery, parseJsonBody } from '../../http/requests';
import { json, noContent } from '../../http/responses';
import type { Route } from '../../http/router';
import { findCalendar } from '../calendars/calendar-operations';
import { authenticate } from '../oauth/oauth-operations';
import { readEvents } from '../oauth/scopes';
import { callbackUrl } from './callback-url';
import { expireChannels, stopChannel } from './channel-operations';
import { drainDeliveries, enqueueDelivery } from './delivery-operations';

/** Channels default to one day and are capped at seven days, like Google. */
const defaultChannelTtlMs = 86400000;
const maxChannelTtlMs = 604800000;

/**
 * Google `events.watch` and `channels.stop`. Only `web_hook` channels are
 * supported. A new channel immediately receives a `sync` message.
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
      const d = parseJsonBody(body);
      fields(d, ['id', 'type', 'address', 'token', 'expiration']);
      const id = string(d.id, 'id');
      if (!/^[\w-]{1,64}$/.test(id)) fail('Invalid channel ID.');
      expireChannels(workspace);
      if (workspace.channels.has(id))
        fail('Duplicate channel ID.', 409, 'duplicate');
      if (d.type !== 'web_hook') fail('Only web_hook channels are supported.');
      const address = string(d.address, 'address');
      callbackUrl(address, workspace.options.allowedWatchHosts);
      const token =
        d.token === undefined ? undefined : string(d.token, 'token');
      if (token && (token.length > 256 || /[\r\n]/.test(token)))
        fail('Invalid channel token.');
      const expiration =
        d.expiration === undefined
          ? workspace.now() + defaultChannelTtlMs
          : Number(d.expiration);
      if (!Number.isSafeInteger(expiration) || expiration <= workspace.now())
        fail('Invalid expiration.');
      const channel: Channel = {
        id,
        grantId: grant.id,
        calendarId: c.id,
        resourceId: `calendar-${c.id}`,
        resourceUri: new URL(
          `/calendar/v3/calendars/${encodeURIComponent(c.id)}/events`,
          url,
        ).href,
        address,
        token,
        expiration: Math.min(expiration, workspace.now() + maxChannelTtlMs),
        message: 0,
        controller: new AbortController(),
        tail: Promise.resolve(),
      };
      workspace.channels.set(id, channel);
      enqueueDelivery(workspace, channel, 'sync');
      return json({
        kind: 'api#channel',
        id,
        resourceId: channel.resourceId,
        resourceUri: channel.resourceUri,
        expiration: String(channel.expiration),
        ...(token ? { token } : {}),
      });
    },
  },
  {
    pattern: /^\/calendar\/v3\/channels\/stop$/,
    handle({ workspace, request, body }) {
      if (request.method !== 'POST') return;
      const grant = authenticate(
        workspace,
        request.headers.get('authorization'),
        readEvents,
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
