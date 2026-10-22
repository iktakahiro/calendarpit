import { fields } from '../../shared/validation';
import { parseJsonBody } from '../../http/requests';
import { json } from '../../http/responses';
import type { Route } from '../../http/router';
import { snapshot } from '../status/snapshot-operations';
import { setRateLimitMode } from './rate-limit-operations';

/**
 * `PUT /__calendarpit/rate-limit`. Sets the saved Calendar API quota mode.
 *
 * The body is `{ "mode": "off" | "production" | "error-test" }`. Unknown fields are
 * rejected. Changing the mode clears the in-memory counters.
 */
export const quotaManagementRoutes: Route[] = [
  {
    pattern: /^\/__calendarpit\/rate-limit$/,
    handle({ workspace, request, body }) {
      if (request.method !== 'PUT') return;
      const data = parseJsonBody(body);
      fields(data, ['mode']);
      setRateLimitMode(workspace, data.mode);
      return json(snapshot(workspace));
    },
  },
];
