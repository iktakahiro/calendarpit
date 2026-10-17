import { parseJsonBody } from '../../http/requests';
import { json, noContent } from '../../http/responses';
import type { Route } from '../../http/router';
import {
  createUser,
  deleteUser,
  findUser,
  updateUser,
} from './user-operations';

/** Management API user endpoints: create, update, and delete. */
export const userManagementRoutes: Route[] = [
  {
    pattern: /^\/__calendarpit\/users(?:\/([^/]+))?$/,
    handle({ workspace, request, body }, [userId]) {
      const method = request.method;
      const existing = userId ? findUser(workspace, userId) : undefined;
      if (method === 'POST' && !existing)
        return json(createUser(workspace, parseJsonBody(body)), 201);
      if (method === 'PATCH' && existing)
        return json(updateUser(workspace, existing, parseJsonBody(body)));
      if (method === 'DELETE' && existing) {
        deleteUser(workspace, existing);
        return noContent();
      }
    },
  },
];
