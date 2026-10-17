import { parseJsonBody } from '../../http/requests';
import { json } from '../../http/responses';
import type { Route } from '../../http/router';
import { snapshot } from '../status/snapshot-operations';
import { loadFixture, resetWorkspace } from './fixture-operations';

/** Management API endpoints that reset the workspace or load a fixture. */
export const fixtureManagementRoutes: Route[] = [
  {
    pattern: /^\/__calendarpit\/reset$/,
    handle({ workspace, request }) {
      if (request.method !== 'POST') return;
      resetWorkspace(workspace);
      return json(snapshot(workspace));
    },
  },
  {
    pattern: /^\/__calendarpit\/fixtures$/,
    handle({ workspace, request, body }) {
      if (request.method !== 'POST') return;
      loadFixture(workspace, parseJsonBody(body));
      return json(snapshot(workspace));
    },
  },
];
