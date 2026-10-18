import { fail } from '../../shared/errors';
import { booleanQuery } from '../../shared/validation';
import { paging } from '../../http/paging';
import { checkQuery, parseJsonBody } from '../../http/requests';
import { json, noContent } from '../../http/responses';
import type { Route, RouteContext } from '../../http/router';
import { authenticate } from '../oauth/oauth-operations';
import {
  readCalendarList,
  readCalendars,
  writeCalendarList,
} from '../oauth/scopes';
import {
  deleteCalendar,
  findCalendar,
  saveCalendar,
} from './calendar-operations';
import { calendarListEtag } from './calendar-list-entry';
import {
  deleteCalendarListEntry,
  getCalendarListEntry,
  insertCalendarListEntry,
  listCalendarEntries,
  patchCalendarListEntry,
  updateCalendarListEntry,
} from './calendar-list-operations';

const accessRoles = ['freeBusyReader', 'reader', 'writer', 'owner'];

/**
 * Rejects a stale `If-Match` header. A missing header does not lock the entry.
 *
 * @throws {@link ApiError} 412 `conditionNotMet`.
 */
function assertMatch(request: Request, etag: string) {
  if (
    request.headers.has('if-match') &&
    ![etag, '*'].includes(request.headers.get('if-match')!)
  )
    fail('Calendar list entry has changed.', 412, 'conditionNotMet');
}

/**
 * Google `calendarList` methods and `calendars.get`. Every listed calendar
 * belongs to the caller, so the access role is always `owner`.
 * `calendarList.watch` lives with the other watch routes.
 */
export const calendarGoogleRoutes: Route[] = [
  {
    pattern: /^\/calendar\/v3\/users\/me\/calendarList$/,
    handle(context) {
      const { workspace, request, url } = context;
      if (request.method === 'GET') {
        checkQuery(url, [
          'maxResults',
          'pageToken',
          'minAccessRole',
          'showDeleted',
          'showHidden',
        ]);
        const showDeleted = booleanQuery(url, 'showDeleted');
        const showHidden = booleanQuery(url, 'showHidden');
        const role = url.searchParams.get('minAccessRole');
        if (role && !accessRoles.includes(role)) fail('Invalid minAccessRole.');
        const grant = authenticate(
          workspace,
          request.headers.get('authorization'),
          readCalendarList,
        );
        const rows = listCalendarEntries(workspace, grant.userId, {
          showDeleted,
          showHidden,
        });
        // Bind opaque cursors to the authenticated user.
        const paginationUrl = new URL(url);
        paginationUrl.searchParams.set('_user', grant.userId);
        return json({
          kind: 'calendar#calendarList',
          etag: calendarListEtag(rows),
          ...paging(workspace, paginationUrl, rows),
        });
      }
      if (request.method === 'POST') {
        checkQuery(url, ['colorRgbFormat']);
        const grant = authenticate(
          workspace,
          request.headers.get('authorization'),
          writeCalendarList,
        );
        return json(
          insertCalendarListEntry(
            workspace,
            grant.userId,
            parseJsonBody(context.body),
            booleanQuery(url, 'colorRgbFormat'),
          ),
        );
      }
    },
  },
  {
    pattern: /^\/calendar\/v3\/users\/me\/calendarList\/([^/]+)$/,
    handle(context, [calendarId]) {
      // POST is `calendarList.watch` on the `/watch` path, which this pattern
      // also matches. Leave POST to that route.
      if (context.request.method === 'POST') return;
      return handleCalendarListEntry(context, calendarId!);
    },
  },
  {
    pattern: /^\/calendar\/v3\/calendars\/([^/]+)$/,
    handle({ workspace, request, url }, [calendarId]) {
      const grant = authenticate(
        workspace,
        request.headers.get('authorization'),
        readCalendars,
      );
      const c = findCalendar(workspace, calendarId!, grant.userId);
      checkQuery(url, []);
      if (request.method !== 'GET')
        fail('Unsupported calendar operation.', 501, 'unsupportedFeature');
      return json({
        kind: 'calendar#calendar',
        id: c.id,
        summary: c.summary,
        timeZone: c.timeZone,
      });
    },
  },
];

/**
 * `calendarList.get`, `patch`, `update`, and `delete` for one calendar id.
 * `primary` resolves to the caller's primary calendar.
 */
function handleCalendarListEntry(context: RouteContext, calendarId: string) {
  const { workspace, request, url } = context;
  const method = request.method;
  const writing = method === 'PATCH' || method === 'PUT';
  checkQuery(url, writing ? ['colorRgbFormat'] : []);
  const grant = authenticate(
    workspace,
    request.headers.get('authorization'),
    writing || method === 'DELETE' ? writeCalendarList : readCalendarList,
  );
  if (method === 'GET')
    return json(getCalendarListEntry(workspace, grant.userId, calendarId));
  const current = getCalendarListEntry(workspace, grant.userId, calendarId);
  assertMatch(request, current.etag);
  if (method === 'DELETE') {
    deleteCalendarListEntry(workspace, grant.userId, calendarId);
    return noContent();
  }
  if (!writing)
    fail('Unsupported calendar list operation.', 501, 'unsupportedFeature');
  const input = parseJsonBody(context.body);
  const colorRgbFormat = booleanQuery(url, 'colorRgbFormat');
  const entry =
    method === 'PATCH'
      ? patchCalendarListEntry(
          workspace,
          grant.userId,
          calendarId,
          input,
          colorRgbFormat,
        )
      : updateCalendarListEntry(
          workspace,
          grant.userId,
          calendarId,
          input,
          colorRgbFormat,
        );
  return json(entry);
}

/** Management API calendar endpoints: create, update, and delete. */
export const calendarManagementRoutes: Route[] = [
  {
    pattern: /^\/__calendarpit\/calendars(?:\/([^/]+))?$/,
    handle({ workspace, request, body }, [calendarId]) {
      const method = request.method;
      const existing = calendarId
        ? findCalendar(workspace, calendarId)
        : undefined;
      if (method === 'POST' || (method === 'PATCH' && existing)) {
        if (method === 'POST' && calendarId)
          fail('Use the calendars collection.');
        const { calendar, created } = saveCalendar(
          workspace,
          parseJsonBody(body),
          existing,
        );
        return json(calendar, created ? 201 : 200);
      }
      if (method === 'DELETE' && existing) {
        deleteCalendar(workspace, existing);
        return noContent();
      }
    },
  },
];
