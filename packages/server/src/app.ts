import { fail } from './shared/errors';
import { faultManagementRoutes } from './features/faults/fault-routes';
import { injectCalendarFault } from './features/faults/fault-operations';
import { readBody, requireSameOrigin } from './http/requests';
import { errorResponse } from './http/responses';
import { dispatch, type Route, type RouteContext } from './http/router';
import { Workspace, type WorkspaceOptions } from './workspace/workspace';
import {
  calendarGoogleRoutes,
  calendarManagementRoutes,
} from './features/calendars/calendar-routes';
import {
  eventGoogleRoutes,
  eventManagementRoutes,
} from './features/events/event-routes';
import { defaultFixture, parseFixture } from './features/fixtures/fixture';
import { fixtureManagementRoutes } from './features/fixtures/fixture-routes';
import { freeBusyGoogleRoutes } from './features/freebusy/freebusy-routes';
import {
  historyManagementRoutes,
  recordExchange,
} from './features/history/history-routes';
import {
  oauthGoogleRoutes,
  oauthManagementRoutes,
} from './features/oauth/oauth-routes';
import {
  healthRoutes,
  statusManagementRoutes,
} from './features/status/status-routes';
import { userManagementRoutes } from './features/users/user-routes';
import { canResumeChannel } from './features/watch/channel-operations';
import { quotaManagementRoutes } from './features/quota/quota-routes';
import { enforceCalendarRateLimit } from './features/quota/rate-limit-operations';
import { drainDeliveries } from './features/watch/delivery-operations';
import {
  watchGoogleRoutes,
  watchManagementRoutes,
} from './features/watch/watch-routes';

/** Paths that Calendarpit handles. Everything else belongs to the host app. */
const servedPaths =
  /^\/(?:__calendarpit|calendar\/v3|oauth|oauth2)(?:\/|$)|^\/userinfo$/;

/** Google-compatible Calendar and OAuth endpoints. */
const googleRoutes: Route[] = [
  ...oauthGoogleRoutes,
  ...calendarGoogleRoutes,
  ...freeBusyGoogleRoutes,
  // Watch must precede events: both match `/events/watch`.
  ...watchGoogleRoutes,
  ...eventGoogleRoutes,
];

/** The management API behind the same-origin and JSON guard. */
const managementRoutes: Route[] = [
  ...statusManagementRoutes,
  ...quotaManagementRoutes,
  ...faultManagementRoutes,
  ...historyManagementRoutes,
  ...fixtureManagementRoutes,
  ...watchManagementRoutes,
  ...oauthManagementRoutes,
  ...userManagementRoutes,
  ...calendarManagementRoutes,
  ...eventManagementRoutes,
];

/**
 * Routes one request. Management writes must be same-origin JSON so a web
 * page cannot change the workspace through the developer's browser.
 */
async function route(context: RouteContext): Promise<Response> {
  const { request, url, workspace } = context;
  const health = await dispatch(healthRoutes, context);
  if (health) return health;
  if (url.pathname.startsWith('/__calendarpit')) {
    requireSameOrigin(request);
    if (
      !['GET', 'HEAD'].includes(request.method) &&
      !request.headers.get('content-type')?.startsWith('application/json')
    )
      fail(
        'Management writes require application/json.',
        415,
        'unsupportedMediaType',
      );
    return (
      (await dispatch(managementRoutes, context)) ??
      fail('Unknown management endpoint or method.', 404, 'notFound')
    );
  }
  // Quota applies to every authenticated Calendar API path, before the
  // handler runs, so a rejected request does not change workspace data.
  // Requests without a valid token are not counted and get the route's 401.
  if (url.pathname.startsWith('/calendar/v3')) {
    injectCalendarFault(workspace, request);
    enforceCalendarRateLimit(workspace, request, url);
  }
  return (
    (await dispatch(googleRoutes, context)) ??
    fail('Unsupported API endpoint or method.', 501, 'unsupportedFeature')
  );
}

/** A running Calendarpit instance. */
export type Calendarpit = {
  /**
   * The live workspace. Embedded tests may read it to assert on state that
   * has no API, such as recorded invitation notifications.
   */
  readonly workspace: Workspace;
  /**
   * Handles a Web `Request`.
   *
   * @returns The response, or `null` for paths Calendarpit does not serve, so
   * a host such as the admin UI can render them.
   */
  handle(request: Request): Promise<Response | null>;
  /** Resolves when every queued watch delivery has finished. */
  drain(): Promise<void>;
  /** Stops deliveries, saves, and releases the database lock. */
  close(): void;
};

/**
 * Creates an isolated Calendarpit instance with its own workspace.
 *
 * The database defaults to `:memory:`, so embedded tests never share state.
 * Each request is one unit of work: the snapshot is saved once after the
 * response is ready. Calendar and OAuth exchanges are recorded in the
 * protocol history with secrets redacted.
 *
 * @example
 * ```ts
 * const calendarpit = createCalendarpit({ fixture });
 * const response = await calendarpit.handle(new Request(url));
 * calendarpit.close();
 * ```
 * @throws Error when the database is locked by another instance or holds an
 * unsupported or invalid snapshot.
 */
export function createCalendarpit(options: WorkspaceOptions = {}): Calendarpit {
  const workspace = new Workspace(
    { ...options, fixture: options.fixture ?? defaultFixture },
    { parseFixture, canResumeChannel },
  );
  return {
    workspace,
    drain: () => drainDeliveries(workspace),
    close: () => workspace.close(),
    async handle(request: Request): Promise<Response | null> {
      const url = new URL(request.url);
      if (!servedPaths.test(url.pathname)) return null;
      const oauth = url.pathname.startsWith('/oauth');
      let body = '';
      let response: Response;
      try {
        body = await readBody(request);
        workspace.assertOpen();
        response = await route({ workspace, request, url, body });
      } catch (error) {
        response = errorResponse(error, oauth);
      }
      if (!url.pathname.startsWith('/__calendarpit'))
        await recordExchange(workspace, request, url, body, response);
      try {
        workspace.persist();
      } catch (error) {
        return errorResponse(error, oauth);
      }
      return response;
    },
  };
}
