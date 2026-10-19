/**
 * Static workspace shown in admin UI previews. It extends the built-in
 * fixture (`alex`, `sam`, `sample-app`, and the planning event on
 * 2026-10-19) with the activity a connected app would leave behind.
 */

/** One timed event in the preview week, in calendar-local hours. */
export type SampleEvent = {
  summary: string;
  /** Day index in the preview week, where 0 is Sunday 2026-10-18. */
  day: number;
  start: number;
  end: number;
  free?: boolean;
};

/** One row of the API history list. */
export type SampleRequest = {
  status: number;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  area: 'calendar' | 'oauth';
  time: string;
};

/** The selected test user, as the sidebar shows it. */
export const sampleUser = {
  id: 'alex',
  name: 'Alex Morgan',
  email: 'alex@example.test',
};

/** Calendars of the selected test user. */
export const sampleCalendars = [
  {
    id: 'alex-work',
    summary: 'Work calendar',
    timeZone: 'Asia/Tokyo',
    primary: true,
  },
  {
    id: 'alex-personal',
    summary: 'Personal',
    timeZone: 'Asia/Tokyo',
    primary: false,
  },
];

/** Preview week: Sunday 2026-10-18 through Saturday 2026-10-24. */
export const sampleWeek = [
  { weekday: 'Sun', date: 18 },
  { weekday: 'Mon', date: 19 },
  { weekday: 'Tue', date: 20 },
  { weekday: 'Wed', date: 21 },
  { weekday: 'Thu', date: 22 },
  { weekday: 'Fri', date: 23 },
  { weekday: 'Sat', date: 24 },
];

/** The day index of "today" in the preview week. */
export const sampleToday = 1;

/** The "now" marker, in hours on the preview day. */
export const sampleNow = 13.75;

/** Events in the preview week. The first one comes from the fixture. */
export const sampleEvents: SampleEvent[] = [
  { summary: 'Weekly planning', day: 1, start: 10, end: 11 },
  { summary: 'Focus time', day: 1, start: 14, end: 16, free: true },
  { summary: 'Design review', day: 2, start: 13, end: 14.5 },
  { summary: '1:1 with Sam', day: 3, start: 15, end: 15.5 },
  { summary: 'Sprint demo', day: 4, start: 11, end: 12 },
  { summary: 'Standup', day: 5, start: 9.5, end: 10 },
  { summary: 'Release check', day: 5, start: 16, end: 17 },
];

/** Requests an app makes while it connects, syncs, and writes events. */
export const sampleRequests: SampleRequest[] = [
  {
    status: 200,
    method: 'POST',
    path: '/calendar/v3/calendars/alex-work/events',
    area: 'calendar',
    time: '13:56:58',
  },
  {
    status: 200,
    method: 'POST',
    path: '/calendar/v3/freeBusy',
    area: 'calendar',
    time: '13:56:58',
  },
  {
    status: 200,
    method: 'POST',
    path: '/calendar/v3/calendars/alex-work/events/watch',
    area: 'calendar',
    time: '13:56:57',
  },
  {
    status: 404,
    method: 'GET',
    path: '/calendar/v3/calendars/alex-work/events/missing',
    area: 'calendar',
    time: '13:56:57',
  },
  {
    status: 200,
    method: 'GET',
    path: '/calendar/v3/calendars/alex-work/events?singleEvents=true&orderBy=startTime',
    area: 'calendar',
    time: '13:56:56',
  },
  {
    status: 200,
    method: 'PATCH',
    path: '/calendar/v3/calendars/alex-work/events/planning',
    area: 'calendar',
    time: '13:56:55',
  },
  {
    status: 200,
    method: 'GET',
    path: '/calendar/v3/users/me/calendarList',
    area: 'calendar',
    time: '13:56:54',
  },
  {
    status: 200,
    method: 'POST',
    path: '/oauth/token',
    area: 'oauth',
    time: '13:56:49',
  },
  {
    status: 302,
    method: 'POST',
    path: '/oauth/authorize',
    area: 'oauth',
    time: '13:56:49',
  },
  {
    status: 200,
    method: 'GET',
    path: '/oauth/authorize?client_id=sample-app&redirect_uri=http%3A%2F%2F127.0.0.1%3A4175%2Fcallback',
    area: 'oauth',
    time: '13:56:43',
  },
];

/** Request and response of the failed lookup, with credentials masked. */
export const sampleFailure = {
  request: {
    headers: {
      accept: 'application/json',
      authorization: '[REDACTED]',
      host: '127.0.0.1:4173',
    },
    body: null,
  },
  response: {
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: {
      error: {
        code: 404,
        message: 'Event not found.',
        errors: [
          {
            domain: 'calendarpit',
            reason: 'notFound',
            message: 'Event not found.',
          },
        ],
      },
    },
  },
};

/** Watch channels opened by the connected app. */
export const sampleChannels = [
  {
    id: 'chan-events',
    calendarId: 'alex-work',
    address: 'http://127.0.0.1:4175/webhook',
    expires: '10/20/2026, 13:56:57',
  },
];

/** Webhook deliveries, newest first. */
export const sampleDeliveries = [
  {
    channel: 'chan-events',
    message: 3,
    state: 'exists',
    attempts: 1,
    time: '10/19/2026, 13:56:58',
    status: 'delivered',
    httpStatus: 200,
  },
  {
    channel: 'chan-events',
    message: 2,
    state: 'exists',
    attempts: 3,
    time: '10/19/2026, 13:56:58',
    status: 'failed',
    httpStatus: 503,
  },
  {
    channel: 'chan-events',
    message: 1,
    state: 'sync',
    attempts: 1,
    time: '10/19/2026, 13:56:57',
    status: 'delivered',
    httpStatus: 200,
  },
] as const;

/** OAuth connections between test users and clients. */
export const sampleConnections = [
  {
    user: 'Alex Morgan',
    client: 'sample-app',
    scopes: ['calendar'],
    granted: '10/19/2026, 13:56:49',
    revoked: false,
  },
  {
    user: 'Sam Rivera',
    client: 'sample-app',
    scopes: ['calendar.readonly'],
    granted: '10/19/2026, 09:12:03',
    revoked: true,
  },
];

/** Registered OAuth clients. */
export const sampleClients = [
  {
    id: 'sample-app',
    redirectUris: ['http://127.0.0.1:4175/callback'],
  },
  {
    id: 'my-app',
    redirectUris: [
      'http://127.0.0.1:3000/auth/google/callback',
      'http://localhost:3000/auth/google/callback',
    ],
  },
];
