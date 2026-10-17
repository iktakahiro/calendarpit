import { decorate, prepareEvent, commitEvent } from './event-actions';
import { expandEvents, instances } from './recurrence';
import {
  booleanQuery,
  readSync,
  issueSync,
  delta,
  eventPage,
  overlaps,
} from './sync';
import { Temporal } from '@js-temporal/polyfill';
import {
  ApiError,
  busy,
  calendarScope,
  fail,
  fields,
  instant,
  interval,
  makeCalendar,
  makeUser,
  object,
  string,
  zone,
  type CalendarEvent,
} from './model';
import {
  authenticate,
  authorization,
  consentPage,
  decide,
  exchange,
  revokeToken,
  secret,
} from './oauth';
import { Store, type StoreOptions, type Channel } from './store';
export { defaultFixture, parseFixture } from './model';
export { resolveDatabase } from './persistence';
export type { Fixture, Calendar, CalendarEvent, User } from './model';
export type { StoreOptions } from './store';
export const VERSION = '0.1.0';
export function getServerStatus(storage: 'memory' | 'sqlite' = 'memory') {
  return {
    name: 'Calendarpit',
    version: VERSION,
    stage: 'mvp',
    storage,
    capabilities: { calendar: true, oauth: true, watch: true, fixtures: true },
  } as const;
}
export type ServerStatus = ReturnType<typeof getServerStatus>;
export type Snapshot = ReturnType<Store['snapshot']>;
const readEvents = [
  calendarScope,
  `${calendarScope}.readonly`,
  `${calendarScope}.events`,
  `${calendarScope}.events.readonly`,
];
const writeEvents = [calendarScope, `${calendarScope}.events`];
const readCalendars = [
  calendarScope,
  `${calendarScope}.readonly`,
  `${calendarScope}.calendars.readonly`,
];
const readList = [
  calendarScope,
  `${calendarScope}.readonly`,
  `${calendarScope}.calendarlist.readonly`,
];
const freeBusyScopes = [
  ...readEvents,
  `${calendarScope}.freebusy`,
  `${calendarScope}.events.freebusy`,
];
const json = (value: unknown, status = 200) =>
  Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
function errorResponse(error: unknown, oauth: boolean) {
  const e =
    error instanceof ApiError
      ? error
      : error instanceof URIError
        ? new ApiError(400, 'invalidParameter', 'Invalid URL encoding.')
        : new ApiError(500, 'internalError', 'Internal server error.');
  if (!(error instanceof ApiError)) console.error(error);
  const response = oauth
    ? json({ error: e.reason, error_description: e.message }, e.status)
    : json(
        {
          error: {
            code: e.status,
            message: e.message,
            errors: [
              { domain: 'calendarpit', reason: e.reason, message: e.message },
            ],
          },
        },
        e.status,
      );
  if (e.status === 401) response.headers.set('WWW-Authenticate', 'Bearer');
  return response;
}
async function bodyText(request: Request) {
  if (Number(request.headers.get('content-length')) > 1048576)
    fail('Request body too large.', 413, 'payloadTooLarge');
  const reader = request.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.length;
      if (length > 1048576) {
        await reader.cancel();
        fail('Request body too large.', 413, 'payloadTooLarge');
      }
      chunks.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks).toString('utf8');
}
function parseBody(text: string) {
  try {
    return object(JSON.parse(text));
  } catch (e) {
    if (e instanceof ApiError) throw e;
    return fail('Invalid JSON body.');
  }
}
const sensitive =
  /^(authorization|cookie|set-cookie|client_secret|secret|access_token|refresh_token|id_token|code|code_verifier|code_challenge|consent|token|x-goog-channel-token|state)$/i;
export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, v]) => [
        key,
        sensitive.test(key) ? '[REDACTED]' : redact(v),
      ]),
    );
  if (typeof value === 'string' && value.length > 12000)
    return value.slice(0, 12000) + ' [truncated]';
  return value;
}
function safeUrl(value: string) {
  try {
    const url = new URL(value, 'http://local');
    for (const key of [...url.searchParams.keys()])
      if (sensitive.test(key)) url.searchParams.set(key, '[REDACTED]');
    url.username = '';
    url.password = '';
    return value.startsWith('/') ? url.pathname + url.search : url.href;
  } catch {
    return '[invalid URL]';
  }
}
function headers(value: Headers) {
  return redact(
    Object.fromEntries(
      [...value].map(([key, v]) => [
        key,
        ['location', 'referer'].includes(key) ? safeUrl(v) : v,
      ]),
    ),
  );
}
function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (
    (origin && origin !== new URL(request.url).origin) ||
    request.headers.get('sec-fetch-site') === 'cross-site'
  )
    fail('Cross-origin management requests are not allowed.', 403, 'forbidden');
}
function checkQuery(url: URL, allowed: string[]) {
  for (const key of url.searchParams.keys())
    if (![...allowed, 'alt', 'prettyPrint', 'quotaUser', 'key'].includes(key))
      fail(`Unsupported query parameter: ${key}`, 400, 'unsupportedFeature');
  if (url.searchParams.has('alt') && url.searchParams.get('alt') !== 'json')
    fail('Only JSON responses are supported.');
}
function paging<T>(store: Store, url: URL, rows: T[]) {
  const raw = url.searchParams.get('maxResults') ?? '250';
  if (!/^\d+$/.test(raw) || +raw < 1 || +raw > 2500)
    fail('maxResults must be between 1 and 2500.');
  const keyUrl = new URL(url);
  keyUrl.searchParams.delete('pageToken');
  keyUrl.searchParams.sort();
  const key = keyUrl.pathname + keyUrl.search;
  let offset = 0;
  const token = url.searchParams.get('pageToken');
  if (token) {
    const page = store.pages.get(token);
    if (!page || page.key !== key || page.revision !== store.revision)
      fail('Invalid or stale page token.', 410, 'invalidPageToken');
    offset = page.offset;
  }
  let nextPageToken: string | undefined;
  if (offset + +raw < rows.length) {
    nextPageToken = secret();
    if (store.pages.size > 1000) store.pages.clear();
    store.pages.set(nextPageToken, {
      key,
      revision: store.revision,
      offset: offset + +raw,
    });
  }
  return {
    items: rows.slice(offset, offset + +raw),
    ...(nextPageToken ? { nextPageToken } : {}),
  };
}
function publicEvent(event: CalendarEvent) {
  const { calendarId: _calendarId, ...data } = event;
  return data;
}
export function createCalendarpit(options: StoreOptions = {}) {
  const store = new Store(options);
  async function dispatch(
    request: Request,
    url: URL,
    text: string,
  ): Promise<Response> {
    const path = url.pathname;
    const method = request.method;
    if (path === '/__calendarpit/health') {
      if (!['GET', 'HEAD'].includes(method))
        return new Response(null, {
          status: 405,
          headers: { Allow: 'GET, HEAD' },
        });
      return method === 'HEAD'
        ? new Response(null, { headers: { 'Cache-Control': 'no-store' } })
        : json(getServerStatus(store.storage.mode));
    }
    if (path.startsWith('/__calendarpit')) {
      sameOrigin(request);
      if (
        !['GET', 'HEAD'].includes(method) &&
        !request.headers.get('content-type')?.startsWith('application/json')
      )
        fail(
          'Management writes require application/json.',
          415,
          'unsupportedMediaType',
        );
      if (path === '/__calendarpit/state' && method === 'GET')
        return json(store.snapshot());
      if (path === '/__calendarpit/history' && method === 'GET')
        return json(store.history);
      if (path === '/__calendarpit/history' && method === 'DELETE') {
        store.history = [];
        return new Response(null, { status: 204 });
      }
      if (path === '/__calendarpit/reset' && method === 'POST') {
        store.reset();
        return json(store.snapshot());
      }
      if (path === '/__calendarpit/fixtures' && method === 'POST') {
        store.load(parseBody(text));
        return json(store.snapshot());
      }
      if (path === '/__calendarpit/deliveries/drain' && method === 'POST') {
        await store.drain();
        return json(store.deliveries);
      }
      const revoke = /^\/__calendarpit\/connections\/([^/]+)\/revoke$/.exec(
        path,
      );
      if (revoke && method === 'POST') {
        store.revoke(decodeURIComponent(revoke[1]!));
        return new Response(null, { status: 204 });
      }
      const userRoute = /^\/__calendarpit\/users(?:\/([^/]+))?$/.exec(path);
      if (userRoute) {
        const userId = userRoute[1] && decodeURIComponent(userRoute[1]);
        const existing = store.data.users.find((u) => u.id === userId);
        if (userId && !existing) fail('User not found.', 404, 'notFound');
        if (method === 'POST' && !userId) {
          const user = makeUser(parseBody(text));
          if (store.data.users.some((u) => u.id === user.id))
            fail('Duplicate user ID.', 409, 'duplicate');
          store.data.users.push(user);
          store.touch();
          return json(user, 201);
        }
        if (method === 'PATCH' && existing) {
          const data = parseBody(text);
          if (data.id !== undefined && data.id !== existing.id)
            fail('User IDs are immutable.');
          const user = makeUser({ ...existing, ...data });
          Object.assign(existing, user);
          store.touch();
          return json(user);
        }
        if (method === 'DELETE' && existing) {
          for (const g of store.grants.values())
            if (g.userId === existing.id) store.revoke(g.id);
          const ids = store.data.calendars
            .filter((c) => c.userId === existing.id)
            .map((c) => c.id);
          store.data.events = store.data.events.filter(
            (e) => !ids.includes(e.calendarId),
          );
          store.data.calendars = store.data.calendars.filter(
            (c) => c.userId !== existing.id,
          );
          store.data.users = store.data.users.filter((u) => u !== existing);
          store.touch();
          return new Response(null, { status: 204 });
        }
      }
      const calendarRoute = /^\/__calendarpit\/calendars(?:\/([^/]+))?$/.exec(
        path,
      );
      if (calendarRoute) {
        const calendarId =
          calendarRoute[1] && decodeURIComponent(calendarRoute[1]);
        const existing = calendarId ? store.calendar(calendarId) : undefined;
        if (method === 'POST' || (method === 'PATCH' && existing)) {
          if (method === 'POST' && calendarId)
            fail('Use the calendars collection.');
          const data = parseBody(text);
          if (
            existing &&
            ((data.id !== undefined && data.id !== existing.id) ||
              (data.userId !== undefined && data.userId !== existing.userId))
          )
            fail('Calendar ID and owner are immutable.');
          const c = makeCalendar({ ...existing, ...data });
          if (!store.data.users.some((u) => u.id === c.userId))
            fail('Unknown owner.');
          if (
            !existing &&
            store.data.calendars.some((other) => other.id === c.id)
          )
            fail('Duplicate calendar ID.', 409, 'duplicate');
          const peers = store.data.calendars.filter(
            (other) => other.userId === c.userId && other.id !== c.id,
          );
          if (!peers.length) c.primary = true;
          if (existing?.primary && !c.primary)
            fail('Choose another calendar as primary first.');
          // Changing the zone must not invalidate saved all-day intervals.
          for (const e of store.data.events.filter(
            (e) => e.calendarId === c.id,
          )) {
            const [a, b] = interval(e, c);
            if (b <= a) fail('The new time zone invalidates a saved event.');
          }
          if (c.primary) for (const peer of peers) peer.primary = false;
          if (existing) Object.assign(existing, c);
          else {
            store.deletedCalendars = store.deletedCalendars.filter(
              (removed) => removed.id !== c.id,
            );
            store.data.calendars.push(c);
          }
          store.touch();
          return json(c, existing ? 200 : 201);
        }
        if (method === 'DELETE' && existing) {
          store.deletedCalendars.push(structuredClone(existing));
          store.data.calendars = store.data.calendars.filter(
            (c) => c !== existing,
          );
          store.data.events = store.data.events.filter(
            (e) => e.calendarId !== existing.id,
          );
          for (const c of store.channels.values())
            if (c.calendarId === existing.id) store.stop(c);
          if (existing.primary) {
            const next = store.data.calendars.find(
              (c) => c.userId === existing.userId,
            );
            if (next) next.primary = true;
          }
          store.touch();
          return new Response(null, { status: 204 });
        }
      }
      const events =
        /^\/__calendarpit\/calendars\/([^/]+)\/events(?:\/([^/]+))?$/.exec(
          path,
        );
      if (events)
        return eventRoute(
          request,
          url,
          store.calendar(decodeURIComponent(events[1]!)),
          events[2] && decodeURIComponent(events[2]),
          text,
          true,
        );
      fail('Unknown management endpoint or method.', 404, 'notFound');
    }
    if (path === '/oauth/authorize' && method === 'GET')
      return consentPage(store, authorization(store, url.searchParams));
    if (path === '/oauth/authorize' && method === 'POST') {
      sameOrigin(request);
      return decide(store, new URLSearchParams(text));
    }
    if (path === '/oauth/token' && method === 'POST')
      return exchange(store, request, new URLSearchParams(text));
    if (path === '/oauth/revoke' && method === 'POST')
      return revokeToken(
        store,
        new URLSearchParams(text).get('token') ?? url.searchParams.get('token'),
      );
    if (path === '/userinfo' && method === 'GET') {
      const grant = authenticate(store, request, [
        'openid',
        'email',
        'profile',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
      ]);
      const user = store.data.users.find((u) => u.id === grant.userId)!;
      return json({
        sub: user.id,
        id: user.id,
        ...(grant.scopes.some(
          (s) => s === 'email' || s.endsWith('/userinfo.email'),
        )
          ? { email: user.email, verified_email: true, email_verified: true }
          : {}),
        ...(grant.scopes.some(
          (s) => s === 'profile' || s.endsWith('/userinfo.profile'),
        )
          ? { name: user.name }
          : {}),
      });
    }
    if (path === '/calendar/v3/users/me/calendarList' && method === 'GET') {
      checkQuery(url, [
        'maxResults',
        'pageToken',
        'minAccessRole',
        'showDeleted',
      ]);
      const showDeleted = booleanQuery(url, 'showDeleted');
      const role = url.searchParams.get('minAccessRole');
      if (
        role &&
        !['freeBusyReader', 'reader', 'writer', 'owner'].includes(role)
      )
        fail('Invalid minAccessRole.');
      const grant = authenticate(store, request, readList);
      const rows = [
        ...store.data.calendars,
        ...(showDeleted ? store.deletedCalendars : []),
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
          ...(store.deletedCalendars.includes(c) ? { deleted: true } : {}),
        }));
      // Bind opaque cursors to the authenticated user.
      const paginationUrl = new URL(url);
      paginationUrl.searchParams.set('_user', grant.userId);
      return json({
        kind: 'calendar#calendarList',
        ...paging(store, paginationUrl, rows),
      });
    }
    if (path === '/calendar/v3/freeBusy' && method === 'POST') {
      checkQuery(url, []);
      const grant = authenticate(store, request, freeBusyScopes);
      const d = parseBody(text);
      fields(d, [
        'timeMin',
        'timeMax',
        'timeZone',
        'items',
        'calendarExpansionMax',
        'groupExpansionMax',
      ]);
      if (d.groupExpansionMax !== undefined)
        fail('Calendar groups are not supported.', 400, 'unsupportedFeature');
      const min = instant(d.timeMin),
        max = instant(d.timeMax);
      if (max <= min) fail('timeMax must be after timeMin.');
      const tz = zone(d.timeZone);
      if (!Array.isArray(d.items) || d.items.length > 50)
        fail('items must contain at most 50 calendars.');
      if (
        d.calendarExpansionMax !== undefined &&
        (!Number.isInteger(d.calendarExpansionMax) ||
          Number(d.calendarExpansionMax) < 1 ||
          Number(d.calendarExpansionMax) > 50)
      )
        fail('Invalid calendarExpansionMax.');
      if (
        d.calendarExpansionMax !== undefined &&
        d.items.length > Number(d.calendarExpansionMax)
      )
        fail('Too many calendars.');
      const calendars: Record<string, unknown> = Object.create(null);
      for (const item of d.items) {
        const data = object(item);
        fields(data, ['id']);
        const id = string(data.id, 'id');
        try {
          const c = store.calendar(id, grant.userId);
          calendars[id] = {
            busy: busy(store.data.events, c, min, max).map((r) =>
              Object.fromEntries(
                Object.entries(r).map(([k, v]) => [
                  k,
                  Temporal.Instant.from(v)
                    .toZonedDateTimeISO(tz)
                    .toString({ timeZoneName: 'never' }),
                ]),
              ),
            ),
          };
        } catch (e) {
          if (!(e instanceof ApiError) || e.status !== 404) throw e;
          calendars[id] = {
            errors: [{ domain: 'global', reason: 'notFound' }],
            busy: [],
          };
        }
      }
      return json({
        kind: 'calendar#freeBusy',
        timeMin: d.timeMin,
        timeMax: d.timeMax,
        calendars,
      });
    }
    if (path === '/calendar/v3/channels/stop' && method === 'POST') {
      const grant = authenticate(store, request, readEvents);
      const d = parseBody(text);
      fields(d, ['id', 'resourceId']);
      const c = store.channels.get(string(d.id, 'id'));
      if (!c || c.resourceId !== d.resourceId || c.grantId !== grant.id)
        fail('Channel not found.', 404, 'notFound');
      store.stop(c);
      return new Response(null, { status: 204 });
    }
    const calendarRoute =
      /^\/calendar\/v3\/calendars\/([^/]+)(?:\/events(?:\/([^/]+)(?:\/(instances))?)?)?$/.exec(
        path,
      );
    if (calendarRoute) {
      const isEvents = /^\/calendar\/v3\/calendars\/[^/]+\/events(?:\/|$)/.test(
        path,
      );
      const grant = authenticate(
        store,
        request,
        isEvents
          ? method === 'GET' || calendarRoute[2] === 'watch'
            ? readEvents
            : writeEvents
          : readCalendars,
      );
      const c = store.calendar(
        decodeURIComponent(calendarRoute[1]!),
        grant.userId,
      );
      if (!isEvents) {
        checkQuery(url, []);
        if (method !== 'GET')
          fail('Unsupported calendar operation.', 501, 'unsupportedFeature');
        return json({
          kind: 'calendar#calendar',
          id: c.id,
          summary: c.summary,
          timeZone: c.timeZone,
        });
      }
      if (calendarRoute[2] === 'watch' && method === 'POST') {
        checkQuery(url, []);
        const d = parseBody(text);
        fields(d, ['id', 'type', 'address', 'token', 'expiration']);
        const id = string(d.id, 'id');
        if (!/^[\w-]{1,64}$/.test(id)) fail('Invalid channel ID.');
        store.expireChannels();
        if (store.channels.has(id))
          fail('Duplicate channel ID.', 409, 'duplicate');
        if (d.type !== 'web_hook')
          fail('Only web_hook channels are supported.');
        const address = string(d.address, 'address');
        store.callback(address);
        const token =
          d.token === undefined ? undefined : string(d.token, 'token');
        if (token && (token.length > 256 || /[\r\n]/.test(token)))
          fail('Invalid channel token.');
        const expiration =
          d.expiration === undefined
            ? store.now() + 86400000
            : Number(d.expiration);
        if (!Number.isSafeInteger(expiration) || expiration <= store.now())
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
          expiration: Math.min(expiration, store.now() + 604800000),
          message: 0,
          controller: new AbortController(),
          tail: Promise.resolve(),
        };
        store.channels.set(id, channel);
        store.enqueue(channel, 'sync');
        return json({
          kind: 'api#channel',
          id,
          resourceId: channel.resourceId,
          resourceUri: channel.resourceUri,
          expiration: String(channel.expiration),
          ...(token ? { token } : {}),
        });
      }
      const response = await eventRoute(
        request,
        url,
        c,
        calendarRoute[2] && decodeURIComponent(calendarRoute[2]),
        text,
        false,
        grant.userId,
        calendarRoute[3] === 'instances',
      );
      return response;
    }
    fail('Unsupported API endpoint or method.', 501, 'unsupportedFeature');
  }
  async function eventRoute(
    request: Request,
    url: URL,
    calendar: ReturnType<Store['calendar']>,
    eventId: string | undefined,
    text: string,
    admin: boolean,
    userId = 'admin',
    instanceList = false,
  ) {
    const method = request.method;
    const listing = method === 'GET' && (!eventId || instanceList);
    checkQuery(
      url,
      listing
        ? [
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
            ...(instanceList ? ['originalStart'] : []),
          ]
        : method === 'GET'
          ? ['timeZone']
          : ['sendUpdates', 'conferenceDataVersion'],
    );
    const tz = url.searchParams.has('timeZone')
      ? zone(url.searchParams.get('timeZone'))
      : calendar.timeZone;
    const represent = (event: CalendarEvent) => {
      const data = decorate(store, event, calendar);
      if (!data.start.date) {
        for (const key of ['start', 'end'] as const)
          data[key] = {
            dateTime: Temporal.Instant.from(data[key].dateTime!)
              .toZonedDateTimeISO(tz)
              .toString({ timeZoneName: 'never' }),
            timeZone: tz,
          };
      }
      return admin ? data : publicEvent(data);
    };
    if (listing) {
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
        for (const key of [
          'timeMin',
          'timeMax',
          'orderBy',
          'updatedMin',
          'privateExtendedProperty',
          'sharedExtendedProperty',
          'iCalUID',
        ])
          if (url.searchParams.has(key))
            fail(`${key} cannot be combined with syncToken.`);
      }
      const state = syncToken
        ? readSync(store, syncToken, calendar, userId, single, tz)
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
      const source = store.data.events.filter(
        (e) => e.calendarId === calendar.id,
      );
      let rows: CalendarEvent[] = [];
      let nextSyncToken: string | undefined;
      if (!url.searchParams.has('pageToken')) {
        if (state) rows = delta(state, source, calendar);
        else if (instanceList) {
          const master = store.event(calendar.id, eventId!);
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
            rows = rows.filter(
              (e) =>
                e.originalStartTime?.date === original ||
                (e.originalStartTime?.dateTime &&
                  instant(e.originalStartTime.dateTime) === instant(original)),
            );
        } else if (single) rows = expandEvents(source, calendar, min, max);
        else
          rows = source.filter((e) =>
            e.recurrence
              ? (!Number.isFinite(min) && !Number.isFinite(max)) ||
                instances(e, calendar, min, max).length > 0
              : overlaps(e, calendar, min, max),
          );
        if (!state) {
          rows = rows.filter(
            (e) =>
              (showDeleted ||
                updatedMin !== undefined ||
                e.status !== 'cancelled' ||
                (!single && !!e.recurringEventId)) &&
              (updatedMin === undefined || instant(e.updated) >= updatedMin),
          );
          for (const [query, key] of [
            ['privateExtendedProperty', 'private'],
            ['sharedExtendedProperty', 'shared'],
          ] as const) {
            for (const filter of url.searchParams.getAll(query)) {
              const equals = filter.indexOf('=');
              if (equals < 1) fail(`Invalid ${query}; expected name=value.`);
              rows = rows.filter(
                (e) =>
                  e.extendedProperties?.[key]?.[filter.slice(0, equals)] ===
                  filter.slice(equals + 1),
              );
            }
          }
          const uid = url.searchParams.get('iCalUID');
          if (uid)
            rows = rows.filter(
              (e) => decorate(store, e, calendar).iCalUID === uid,
            );
        }
        rows.sort(
          (a, b) =>
            (order === 'startTime'
              ? interval(a, calendar)[0] - interval(b, calendar)[0]
              : order === 'updated'
                ? instant(a.updated) - instant(b.updated)
                : 0) || a.id.localeCompare(b.id),
        );
        if (!instanceList)
          nextSyncToken = issueSync(store, {
            calendarId: calendar.id,
            userId,
            singleEvents: single,
            timeZone: tz,
            ...(Number.isFinite(min) ? { min } : {}),
            ...(Number.isFinite(max) ? { max } : {}),
          });
      }
      const page = eventPage(store, url, userId, rows, nextSyncToken);
      return json({
        kind: 'calendar#events',
        summary: calendar.summary,
        timeZone: tz,
        accessRole: 'owner',
        ...page,
        items: page.items.map(represent),
      });
    }
    if (instanceList)
      fail('Unsupported instances operation.', 405, 'methodNotAllowed');
    const sendUpdates = url.searchParams.get('sendUpdates') ?? 'none';
    if (!['all', 'externalOnly', 'none'].includes(sendUpdates))
      fail('Invalid sendUpdates.');
    const conferenceVersion = url.searchParams.get('conferenceDataVersion');
    if (conferenceVersion !== null && !['0', '1'].includes(conferenceVersion))
      fail('conferenceDataVersion must be 0 or 1.');
    const existing = eventId ? store.event(calendar.id, eventId) : undefined;
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
      const event = {
        ...decorate(store, existing, calendar),
        status: 'cancelled' as const,
        updated: new Date(store.now()).toISOString(),
        etag: `"${crypto.randomUUID()}"`,
      };
      commitEvent(store, calendar, event, existing, sendUpdates);
      return new Response(null, { status: 204 });
    }
    if (
      (method === 'POST' && !eventId) ||
      (['PATCH', 'PUT'].includes(method) && existing)
    ) {
      const event = prepareEvent(
        store,
        calendar,
        parseBody(text),
        existing,
        method === 'PATCH',
        admin,
        conferenceVersion,
      );
      if (
        !existing &&
        store.data.events.some(
          (e) => e.calendarId === calendar.id && e.id === event.id,
        )
      )
        fail('Duplicate event ID.', 409, 'duplicate');
      commitEvent(store, calendar, event, existing, sendUpdates);
      return json(represent(event));
    }
    return fail('Unsupported event method.', 405, 'methodNotAllowed');
  }
  return {
    store,
    close: () => store.close(),
    async handle(request: Request): Promise<Response | null> {
      const url = new URL(request.url);
      if (
        !/^\/(?:__calendarpit|calendar\/v3|oauth|oauth2)(?:\/|$)/.test(
          url.pathname,
        ) &&
        url.pathname !== '/userinfo'
      )
        return null;
      const record = !url.pathname.startsWith('/__calendarpit');
      let text = '';
      let response: Response;
      try {
        text = await bodyText(request);
        store.assertOpen();
        response = await dispatch(request, url, text);
      } catch (error) {
        response = errorResponse(error, url.pathname.startsWith('/oauth'));
      }
      if (record) {
        let requestBody: unknown = text ? '[Unparsed body]' : null;
        try {
          requestBody = JSON.parse(text);
        } catch {
          if (request.headers.get('content-type')?.includes('form-urlencoded'))
            requestBody = Object.fromEntries(new URLSearchParams(text));
        }
        let responseBody: unknown = null;
        if (response.headers.get('content-type')?.includes('json'))
          responseBody = await response.clone().json();
        else if (response.headers.get('content-type')?.includes('html'))
          responseBody = '[Consent HTML]';
        store.history.push({
          id: crypto.randomUUID(),
          time: new Date(store.now()).toISOString(),
          method: request.method,
          path: safeUrl(url.pathname + url.search),
          status: response.status,
          request: redact(requestBody),
          response: redact(responseBody),
          headers: headers(request.headers),
          responseHeaders: headers(response.headers),
        });
        store.history = store.history.slice(-200);
      }
      try {
        store.persist();
      } catch (error) {
        return errorResponse(error, url.pathname.startsWith('/oauth'));
      }
      return response;
    },
  };
}
