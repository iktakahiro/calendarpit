import { json } from '../../http/responses';
import type { Route } from '../../http/router';
import { getServerStatus } from './server-status';
import { snapshot } from './snapshot-operations';

/**
 * `GET`/`HEAD /__calendarpit/health`. It is outside the management API
 * guard, so probes need no same-origin or content-type headers.
 */
export const healthRoutes: Route[] = [
  {
    pattern: /^\/__calendarpit\/health$/,
    handle({ workspace, request }) {
      if (request.method === 'HEAD')
        return new Response(null, { headers: { 'Cache-Control': 'no-store' } });
      if (request.method === 'GET')
        return json(getServerStatus(workspace.storage.mode));
      return new Response(null, {
        status: 405,
        headers: { Allow: 'GET, HEAD' },
      });
    },
  },
];

/** `GET /__calendarpit/state`, the admin UI's data source. */
export const statusManagementRoutes: Route[] = [
  {
    pattern: /^\/__calendarpit\/state$/,
    handle({ workspace, request }) {
      if (request.method === 'GET') return json(snapshot(workspace));
    },
  },
];
