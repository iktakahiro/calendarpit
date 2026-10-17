import { fail } from '../../shared/errors';
import { booleanQuery, instant, zone } from '../../shared/validation';
import type { Calendar } from '../../model/directory';
import type { CalendarEvent } from '../../model/event';
import { maxResults } from '../../http/paging';
import { checkQuery, parseJsonBody } from '../../http/requests';
import { json, noContent } from '../../http/responses';
import type { Route, RouteContext } from '../../http/router';
import { findCalendar } from '../calendars/calendar-operations';
import { authenticate } from '../oauth/oauth-operations';
import { readEvents, writeEvents } from '../oauth/scopes';
import { filterEvents, matchesOriginalStart, sortEvents } from './event-list';
import {
  calendarEvents,
  commitEvent,
  decorateEvent,
  findEvent,
  calendarOwner,
} from './event-operations';
import { eventPage } from './event-page-operations';
import { prepareEvent } from './event-preparation';
import { inTimeZone, publicEvent } from './event-presentation';
import { delta } from './event-sync';
import { issueSync, readSync } from './event-sync-operations';
import { instances, expandEvents } from './recurrence';
import { overlaps } from './event-time';

/** Who is calling an event endpoint. */
type Caller = {
  /** Management API callers see `calendarId` and may set read-only fields. */
  admin: boolean;
  /** Owner of the sync and page tokens the request creates. */
  userId: string;
};

const listParameters = [
  'timeMin',
  'timeMax',
  'maxResults',
  'pageToken',
  'orderBy',
  'singleEvents',
  'timeZone',
  'showDeleted',
  'syncToken',
  'privateExtendedProperty',
  'sharedExtendedProperty',
  'updatedMin',
  'iCalUID',
];

/** Parameters that cannot be combined with `syncToken`, as in Google. */
const fullSyncOnlyParameters = [
  'timeMin',
  'timeMax',
  'orderBy',
  'updatedMin',
  'privateExtendedProperty',
  'sharedExtendedProperty',
  'iCalUID',
];

/**
 * Serves `events.list` and `events.instances`, both full and incremental.
 */
function listEvents(
  { workspace, url }: RouteContext,
  calendar: Calendar,
  eventId: string | undefined,
  caller: Caller,
  instanceList: boolean,
  timeZone: string,
  represent: (event: CalendarEvent) => unknown,
) {
  const single = booleanQuery(url, 'singleEvents', instanceList);
  const showDeleted = booleanQuery(url, 'showDeleted');
  const syncToken = url.searchParams.get('syncToken');
  const order = url.searchParams.get('orderBy');
  if (order && !['startTime', 'updated'].includes(order))
    fail('Invalid orderBy.');
  if (order === 'startTime' && !single)
    fail('startTime ordering requires singleEvents=true.');
  if (syncToken) {
    if (instanceList) fail('instances does not support syncToken.');
    if (url.searchParams.get('showDeleted') === 'false')
      fail('Incremental synchronization must include deleted events.');
    for (const key of fullSyncOnlyParameters)
      if (url.searchParams.has(key))
        fail(`${key} cannot be combined with syncToken.`);
  }
  const state = syncToken
    ? readSync(workspace, syncToken, calendar, caller.userId, single, timeZone)
    : undefined;
  const min =
    state?.min ??
    (url.searchParams.has('timeMin')
      ? instant(url.searchParams.get('timeMin'))
      : -Infinity);
  const max =
    state?.max ??
    (url.searchParams.has('timeMax')
      ? instant(url.searchParams.get('timeMax'))
      : Infinity);
  if (max <= min) fail('Invalid time range.');
  const updatedMin = url.searchParams.has('updatedMin')
    ? instant(url.searchParams.get('updatedMin'))
    : undefined;
  const source = calendarEvents(workspace, calendar.id);
  let rows: CalendarEvent[] = [];
  let nextSyncToken: string | undefined;
  // Later pages come from the frozen first page, so rows are only built once.
  if (!url.searchParams.has('pageToken')) {
    if (state) rows = delta(state, source, calendar);
    else if (instanceList) {
      const master = findEvent(workspace, calendar.id, eventId!);
      if (!master.recurrence) fail('Event is not a recurring series.');
      rows = expandEvents(
        source.filter(
          (e) => e.id === master.id || e.recurringEventId === master.id,
        ),
        calendar,
        min,
        max,
      );
      const original = url.searchParams.get('originalStart');
      if (original)
        rows = rows.filter((e) => matchesOriginalStart(e, original));
    } else if (single) rows = expandEvents(source, calendar, min, max);
    else
      rows = source.filter((e) =>
        e.recurrence
          ? (!Number.isFinite(min) && !Number.isFinite(max)) ||
            instances(e, calendar, min, max).length > 0
          : overlaps(e, calendar, min, max),
      );
    if (!state)
      rows = filterEvents(rows, {
        showDeleted,
        singleEvents: single,
        updatedMin,
        privateProperties: url.searchParams.getAll('privateExtendedProperty'),
        sharedProperties: url.searchParams.getAll('sharedExtendedProperty'),
        iCalUID: url.searchParams.get('iCalUID') ?? undefined,
      });
    sortEvents(rows, order, calendar);
    if (!instanceList)
      nextSyncToken = issueSync(workspace, {
        calendarId: calendar.id,
        userId: caller.userId,
        singleEvents: single,
        timeZone,
        ...(Number.isFinite(min) ? { min } : {}),
        ...(Number.isFinite(max) ? { max } : {}),
      });
  }
  const page = eventPage(
    workspace,
    url,
    maxResults(url),
    caller.userId,
    rows,
    nextSyncToken,
  );
  return json({
    kind: 'calendar#events',
    summary: calendar.summary,
    timeZone,
    accessRole: 'owner',
    ...page,
    items: page.items.map(represent),
  });
}

/**
 * Handles every event endpoint below one calendar: list, instances, get,
 * insert, update, patch, and delete. The Google and management APIs share it
 * and differ only in {@link Caller}.
 *
 * @param eventId - Event ID from the path, if any.
 * @param instanceList - The path ends in `/instances`.
 */
async function handleEvents(
  context: RouteContext,
  calendar: Calendar,
  eventId: string | undefined,
  caller: Caller,
  instanceList = false,
) {
  const { workspace, request, url } = context;
  const method = request.method;
  const listing = method === 'GET' && (!eventId || instanceList);
  checkQuery(
    url,
    listing
      ? [...listParameters, ...(instanceList ? ['originalStart'] : [])]
      : method === 'GET'
        ? ['timeZone']
        : ['sendUpdates', 'conferenceDataVersion'],
  );
  const tz = url.searchParams.has('timeZone')
    ? zone(url.searchParams.get('timeZone'))
    : calendar.timeZone;
  const represent = (event: CalendarEvent) => {
    const data = inTimeZone(decorateEvent(workspace, event, calendar), tz);
    return caller.admin ? data : publicEvent(data);
  };
  if (listing)
    return listEvents(
      context,
      calendar,
      eventId,
      caller,
      instanceList,
      tz,
      represent,
    );
  if (instanceList)
    fail('Unsupported instances operation.', 405, 'methodNotAllowed');
  const sendUpdates = url.searchParams.get('sendUpdates') ?? 'none';
  if (!['all', 'externalOnly', 'none'].includes(sendUpdates))
    fail('Invalid sendUpdates.');
  const conferenceDataVersion = url.searchParams.get('conferenceDataVersion');
  if (
    conferenceDataVersion !== null &&
    !['0', '1'].includes(conferenceDataVersion)
  )
    fail('conferenceDataVersion must be 0 or 1.');
  const existing = eventId
    ? findEvent(workspace, calendar.id, eventId)
    : undefined;
  if (
    existing &&
    request.headers.has('if-match') &&
    ![existing.etag, '*'].includes(request.headers.get('if-match')!)
  )
    fail('Event has changed.', 412, 'conditionNotMet');
  if (method === 'GET' && existing) return json(represent(existing));
  if (method === 'DELETE' && existing) {
    if (existing.status === 'cancelled')
      fail('Event is already deleted.', 410, 'deleted');
    // Deletion keeps a cancelled record, as Google does for sync clients.
    const event = {
      ...decorateEvent(workspace, existing, calendar),
      status: 'cancelled' as const,
      updated: new Date(workspace.now()).toISOString(),
      etag: `"${crypto.randomUUID()}"`,
    };
    commitEvent(workspace, calendar, event, existing, sendUpdates);
    return noContent();
  }
  if (
    (method === 'POST' && !eventId) ||
    (['PATCH', 'PUT'].includes(method) && existing)
  ) {
    const event = prepareEvent(parseJsonBody(context.body), {
      calendar,
      owner: calendarOwner(workspace, calendar),
      now: workspace.now(),
      previous: existing,
      patch: method === 'PATCH',
      admin: caller.admin,
      conferenceDataVersion,
    });
    if (
      !existing &&
      workspace.data.events.some(
        (e) => e.calendarId === calendar.id && e.id === event.id,
      )
    )
      fail('Duplicate event ID.', 409, 'duplicate');
    commitEvent(workspace, calendar, event, existing, sendUpdates);
    return json(represent(event));
  }
  return fail('Unsupported event method.', 405, 'methodNotAllowed');
}

/**
 * Google Calendar `events` endpoints. `events/watch` lives in the watch
 * feature; other methods on that path fall through to this route.
 */
export const eventGoogleRoutes: Route[] = [
  {
    pattern:
      /^\/calendar\/v3\/calendars\/([^/]+)\/events(?:\/([^/]+)(?:\/(instances))?)?$/,
    handle(context, [calendarId, eventId, instancesSegment]) {
      const { workspace, request } = context;
      const grant = authenticate(
        workspace,
        request.headers.get('authorization'),
        request.method === 'GET' || eventId === 'watch'
          ? readEvents
          : writeEvents,
      );
      return handleEvents(
        context,
        findCalendar(workspace, calendarId!, grant.userId),
        eventId,
        { admin: false, userId: grant.userId },
        instancesSegment === 'instances',
      );
    },
  },
];

/** Management API event endpoints used by the admin UI. */
export const eventManagementRoutes: Route[] = [
  {
    pattern: /^\/__calendarpit\/calendars\/([^/]+)\/events(?:\/([^/]+))?$/,
    handle: (context, [calendarId, eventId]) =>
      handleEvents(
        context,
        findCalendar(context.workspace, calendarId!),
        eventId,
        { admin: true, userId: 'admin' },
      ),
  },
];
