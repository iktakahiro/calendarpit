import { parseJsonBody } from '../../http/requests';
import { json } from '../../http/responses';
import type { Route } from '../../http/router';
import { clearFaults, pendingFaults, queueFault } from './fault-operations';

/** Reads, appends to, or clears the process-local fault queue. */
export const faultManagementRoutes: Route[] = [
  {
    pattern: /^\/__calendarpit\/faults$/,
    handle({ workspace, request, body }) {
      if (request.method === 'PUT') queueFault(workspace, parseJsonBody(body));
      else if (request.method === 'DELETE') clearFaults(workspace);
      else if (request.method !== 'GET') return;
      return json({ faults: pendingFaults(workspace) });
    },
  },
];
