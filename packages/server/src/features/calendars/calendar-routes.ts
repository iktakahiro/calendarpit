import { fail } from '../../shared/errors';
import { booleanQuery } from '../../shared/validation';
import { paging } from '../../http/paging';
import { checkQuery, parseJsonBody } from '../../http/requests';
import { json, noContent } from '../../http/responses';
import type { Route } from '../../http/router';
import { authenticate } from '../oauth/oauth-operations';
import { readCalendarList, readCalendars } from '../oauth/scopes';
import {
  deleteCalendar,
  findCalendar,
  saveCalendar,
} from './calendar-operations';

const accessRoles = ['freeBusyReader', 'reader', 'writer', 'owner'];

/**
 * Google `calendarList.list` and `calendars.get`. Every listed calendar
 * belongs to the caller, so the access role is always `owner`.
 */
export const calendarGoogleRoutes: Route[] = [
  {
    pattern: /^\/calendar\/v3\/users\/me\/calendarList$/,
    handle({ workspace, request, url }) {
      if (request.method !== 'GET') return;
      checkQuery(url, [
        'maxResults',
        'pageToken',
        'minAccessRole',
        'showDeleted',
      ]);
      const showDeleted = booleanQuery(url, 'showDeleted');
      const role = url.searchParams.get('minAccessRole');
      if (role && !accessRoles.includes(role)) fail('Invalid minAccessRole.');
      const grant = authenticate(
        workspace,
        request.headers.get('authorization'),
        readCalendarList,
      );
      const rows = [
        ...workspace.data.calendars,
        ...(showDeleted ? workspace.deletedCalendars : []),
      ]
        .filter((c) => c.userId === grant.userId)
        .map((c) => ({
          kind: 'calendar#calendarListEntry',
          id: c.id,
          summary: c.summary,
          timeZone: c.timeZone,
          primary: c.primary,
          accessRole: 'owner',
          selected: true,
          ...(workspace.deletedCalendars.includes(c) ? { deleted: true } : {}),
        }));
      // Bind opaque cursors to the authenticated user.
      const paginationUrl = new URL(url);
      paginationUrl.searchParams.set('_user', grant.userId);
      return json({
        kind: 'calendar#calendarList',
        ...paging(workspace, paginationUrl, rows),
      });
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
