import { Temporal } from '@js-temporal/polyfill';
import {
  attendees,
  reminders,
  person,
  conference,
  guestPermissionDefaults,
  type Attendee,
  type Person,
  type Reminders,
  type Conference,
} from './event-details';
import { validateRecurrence, expandEvents } from './recurrence';

export class ApiError extends Error {
  constructor(
    public status: number,
    public reason: string,
    message: string,
  ) {
    super(message);
  }
}
export function fail(
  message: string,
  status = 400,
  reason = 'invalidParameter',
): never {
  throw new ApiError(status, reason, message);
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    fail('Expected a JSON object.');
  return value as Record<string, unknown>;
}
export function fields(value: Record<string, unknown>, allowed: string[]) {
  for (const key of Object.keys(value))
    if (!allowed.includes(key))
      fail(`Unsupported field: ${key}`, 400, 'unsupportedFeature');
}
export function string(
  value: unknown,
  name: string,
  fallback?: string,
): string {
  if (value === undefined && fallback !== undefined) return fallback;
  if (typeof value !== 'string' || !value.trim() || value.length > 10000)
    fail(`${name} must be a nonempty string.`);
  return value;
}
export function id(value: unknown, fallback = crypto.randomUUID()): string {
  const result = string(value, 'id', fallback);
  if (!/^[a-zA-Z0-9@._-]{1,128}$/.test(result) || result === 'primary')
    fail('Invalid ID.');
  return result;
}
export function zone(value: unknown): string {
  const result = string(value, 'timeZone', 'UTC');
  try {
    new Intl.DateTimeFormat('en', { timeZone: result });
  } catch {
    fail('Invalid IANA time zone.');
  }
  return result;
}
export function instant(value: unknown): number {
  try {
    return Temporal.Instant.from(string(value, 'timestamp')).epochMilliseconds;
  } catch {
    return fail('Expected an RFC3339 timestamp with an offset.');
  }
}
export type User = { id: string; name: string; email: string };
export type Calendar = {
  id: string;
  userId: string;
  summary: string;
  timeZone: string;
  primary: boolean;
};
export type EventTime = { date?: string; dateTime?: string; timeZone?: string };
export type CalendarEvent = {
  id: string;
  calendarId: string;
  kind: 'calendar#event';
  summary: string;
  description?: string;
  location?: string;
  start: EventTime;
  end: EventTime;
  transparency: 'opaque' | 'transparent';
  status: 'confirmed' | 'tentative' | 'cancelled';
  visibility?: 'default' | 'public' | 'private' | 'confidential';
  colorId?: string;
  attendees?: Attendee[];
  guestsCanModify?: boolean;
  guestsCanInviteOthers?: boolean;
  guestsCanSeeOtherGuests?: boolean;
  reminders?: Reminders;
  organizer?: Person;
  creator?: Person;
  iCalUID?: string;
  sequence?: number;
  conferenceData?: Conference;
  hangoutLink?: string;
  recurrence?: string[];
  recurringEventId?: string;
  originalStartTime?: EventTime;
  extendedProperties?: {
    private?: Record<string, string>;
    shared?: Record<string, string>;
  };
  created: string;
  updated: string;
  etag: string;
};
export type Client = { id: string; secret: string; redirectUris: string[] };
export type Fixture = {
  users: User[];
  calendars: Calendar[];
  events: CalendarEvent[];
  clients: Client[];
};
export const calendarScope = 'https://www.googleapis.com/auth/calendar';
export const scopes = [
  calendarScope,
  `${calendarScope}.readonly`,
  `${calendarScope}.events`,
  `${calendarScope}.events.readonly`,
  `${calendarScope}.calendarlist.readonly`,
  `${calendarScope}.calendars.readonly`,
  `${calendarScope}.freebusy`,
  'https://www.googleapis.com/auth/calendar.events.freebusy',
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];
export function eventTime(value: unknown): EventTime {
  const data = object(value);
  fields(data, ['date', 'dateTime', 'timeZone']);
  if (Boolean(data.date) === Boolean(data.dateTime))
    fail('Use exactly one of date and dateTime.');
  const tz = data.timeZone == null ? undefined : zone(data.timeZone);
  if (data.date) {
    const date = string(data.date, 'date');
    try {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw Error();
      Temporal.PlainDate.from(date, { overflow: 'reject' });
    } catch {
      fail('Invalid date.');
    }
    return { date, ...(tz ? { timeZone: tz } : {}) };
  }
  let dateTime = string(data.dateTime, 'dateTime');
  if (/[zZ]|[+-]\d{2}:\d{2}$/.test(dateTime)) instant(dateTime);
  else {
    if (!tz) fail('dateTime requires an offset or timeZone.');
    try {
      dateTime = Temporal.PlainDateTime.from(dateTime)
        .toZonedDateTime(tz, {
          disambiguation: 'reject',
        })
        .toString({ timeZoneName: 'never' });
    } catch {
      fail('Invalid or ambiguous local time; supply an explicit offset.');
    }
  }
  return { dateTime, ...(tz ? { timeZone: tz } : {}) };
}
export function timeValue(time: EventTime, calendarZone: string): number {
  if (time.date)
    return Temporal.PlainDate.from(time.date).toZonedDateTime(calendarZone)
      .epochMilliseconds;
  if (/[zZ]|[+-]\d{2}:\d{2}$/.test(time.dateTime!))
    return instant(time.dateTime);
  return Temporal.PlainDateTime.from(time.dateTime!).toZonedDateTime(
    time.timeZone!,
    { disambiguation: 'reject' },
  ).epochMilliseconds;
}
export function interval(
  event: CalendarEvent,
  calendar: Calendar,
): [number, number] {
  return [
    timeValue(event.start, calendar.timeZone),
    timeValue(event.end, calendar.timeZone),
  ];
}
export function makeEvent(
  value: unknown,
  calendar: Calendar,
  now: number,
  previous?: CalendarEvent,
  patch = false,
): CalendarEvent {
  const input = object(value);
  fields(input, [
    'id',
    'summary',
    'description',
    'location',
    'start',
    'end',
    'transparency',
    'extendedProperties',
    'status',
    'kind',
    'etag',
    'created',
    'updated',
    'calendarId',
    'visibility',
    'colorId',
    'attendees',
    ...Object.keys(guestPermissionDefaults),
    'reminders',
    'organizer',
    'creator',
    'iCalUID',
    'sequence',
    'conferenceData',
    'hangoutLink',
    'recurrence',
    'recurringEventId',
    'originalStartTime',
  ]);
  if (previous && input.id !== undefined && input.id !== previous.id)
    fail('Event IDs are immutable.');
  if (input.calendarId !== undefined && input.calendarId !== calendar.id)
    fail('Calendar IDs are immutable.');
  const data: Record<string, unknown> =
    patch && previous ? { ...previous, ...input } : input;
  if (patch && previous && input.extendedProperties != null) {
    const incoming = object(input.extendedProperties);
    fields(incoming, ['private', 'shared']);
    const merged = structuredClone(previous.extendedProperties ?? {});
    for (const key of ['private', 'shared'] as const) {
      if (!(key in incoming)) continue;
      if (incoming[key] === null) {
        delete merged[key];
        continue;
      }
      const updates = object(incoming[key]);
      const values = { ...merged[key] };
      for (const [name, value] of Object.entries(updates)) {
        if (value === null) delete values[name];
        else if (typeof value === 'string')
          Object.defineProperty(values, name, {
            value,
            enumerable: true,
            configurable: true,
            writable: true,
          });
        else fail('Extended properties must be strings or null for deletion.');
      }
      merged[key] = values;
    }
    data.extendedProperties = merged;
  }
  const start = eventTime(data.start);
  const end = eventTime(data.end);
  if (!!start.date !== !!end.date)
    fail('Start and end must use the same time representation.');
  if (
    data.transparency !== undefined &&
    !['opaque', 'transparent'].includes(String(data.transparency))
  )
    fail('Invalid transparency.');
  if (
    data.status !== undefined &&
    !['confirmed', 'tentative', 'cancelled'].includes(String(data.status))
  )
    fail('Invalid status.');
  let extendedProperties: CalendarEvent['extendedProperties'];
  if (data.extendedProperties != null) {
    const props = object(data.extendedProperties);
    fields(props, ['private', 'shared']);
    extendedProperties = {};
    for (const key of ['private', 'shared'] as const)
      if (props[key] !== undefined) {
        const values = object(props[key]);
        if (Object.values(values).some((v) => typeof v !== 'string'))
          fail('Extended properties must be strings.');
        extendedProperties[key] = values as Record<string, string>;
      }
  }
  const event: CalendarEvent = {
    id: previous?.id ?? id(data.id),
    calendarId: calendar.id,
    kind: 'calendar#event',
    summary:
      data.summary === undefined
        ? ''
        : typeof data.summary === 'string'
          ? data.summary
          : fail('Invalid summary.'),
    start,
    end,
    transparency:
      (data.transparency as CalendarEvent['transparency']) ?? 'opaque',
    status: (data.status as CalendarEvent['status']) ?? 'confirmed',
    created: previous?.created ?? new Date(now).toISOString(),
    updated: new Date(now).toISOString(),
    etag: `"${crypto.randomUUID()}"`,
    ...(extendedProperties ? { extendedProperties } : {}),
  };
  for (const key of ['description', 'location'] as const)
    if (data[key] != null) {
      if (typeof data[key] !== 'string') fail(`Invalid ${key}.`);
      event[key] = data[key];
    }
  if (data.visibility != null) {
    if (
      !['default', 'public', 'private', 'confidential'].includes(
        String(data.visibility),
      )
    )
      fail('Invalid visibility.');
    event.visibility = data.visibility as CalendarEvent['visibility'];
  }
  if (data.colorId != null) {
    if (!/^(?:[1-9]|10|11)$/.test(String(data.colorId)))
      fail('Invalid event colorId.');
    event.colorId = String(data.colorId);
  }
  if (data.attendees != null) event.attendees = attendees(data.attendees);
  for (const key of Object.keys(guestPermissionDefaults) as Array<
    keyof typeof guestPermissionDefaults
  >) {
    const value = data[key];
    if (value !== undefined && typeof value !== 'boolean')
      fail(`${key} must be boolean.`);
    event[key] = value ?? guestPermissionDefaults[key];
  }
  if (data.reminders != null) event.reminders = reminders(data.reminders);
  if (data.organizer != null) event.organizer = person(data.organizer);
  if (data.creator != null) event.creator = person(data.creator);
  if (data.conferenceData != null)
    event.conferenceData = conference(data.conferenceData);
  for (const key of ['iCalUID', 'hangoutLink', 'recurringEventId'] as const)
    if (data[key] != null) event[key] = string(data[key], key);
  if (data.originalStartTime != null)
    event.originalStartTime = eventTime(data.originalStartTime);
  if (Boolean(event.recurringEventId) !== Boolean(event.originalStartTime))
    fail('Instances require recurringEventId and originalStartTime.');
  if (
    data.sequence !== undefined &&
    (!Number.isInteger(data.sequence) || Number(data.sequence) < 0)
  )
    fail('Invalid sequence.');
  event.sequence = previous
    ? (previous.sequence ?? 0) + 1
    : Number(data.sequence ?? 0);
  if (data.recurrence != null) {
    if (
      !Array.isArray(data.recurrence) ||
      data.recurrence.some((v) => typeof v !== 'string')
    )
      fail('recurrence must be an array of strings.');
    if (data.recurrence.length) {
      event.recurrence = data.recurrence as string[];
      if (event.recurringEventId)
        fail('Instances cannot contain recurrence rules.');
      validateRecurrence(event, calendar);
    }
  }
  const [a, b] = interval(event, calendar);
  if (!(b > a)) fail('End must be after start.');
  return event;
}
export function busy(
  events: CalendarEvent[],
  calendar: Calendar,
  min: number,
  max: number,
) {
  const ranges = expandEvents(events, calendar, min, max)
    .filter(
      (e) =>
        e.calendarId === calendar.id &&
        e.status !== 'cancelled' &&
        e.transparency !== 'transparent',
    )
    .map((e) => interval(e, calendar))
    .filter(([a, b]) => a < max && b > min)
    .map(([a, b]) => [Math.max(a, min), Math.min(b, max)] as [number, number])
    .sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const range of ranges) {
    const last = merged.at(-1);
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push(range);
  }
  return merged.map(([start, end]) => ({
    start: new Date(start).toISOString(),
    end: new Date(end).toISOString(),
  }));
}
export function makeUser(value: unknown): User {
  const d = object(value);
  fields(d, ['id', 'name', 'email']);
  const email = string(d.email, 'email');
  if (!/^[^\s@]+@[^\s@]+$/.test(email)) fail('Invalid email.');
  return { id: id(d.id), name: string(d.name, 'name'), email };
}
export function makeCalendar(value: unknown): Calendar {
  const d = object(value);
  fields(d, ['id', 'userId', 'summary', 'timeZone', 'primary']);
  if (d.primary !== undefined && typeof d.primary !== 'boolean')
    fail('primary must be boolean.');
  return {
    id: id(d.id),
    userId: string(d.userId, 'userId'),
    summary: string(d.summary, 'summary'),
    timeZone: zone(d.timeZone),
    primary: d.primary === true,
  };
}
export function parseFixture(value: unknown, now: number): Fixture {
  const d = object(value);
  fields(d, ['users', 'calendars', 'events', 'clients']);
  for (const key of ['users', 'calendars', 'events', 'clients'])
    if (d[key] !== undefined && !Array.isArray(d[key]))
      fail(`${key} must be an array.`);
  const users = ((d.users ?? []) as unknown[]).map(makeUser);
  const calendars = ((d.calendars ?? []) as unknown[]).map(makeCalendar);
  for (const calendar of calendars)
    if (!users.some((u) => u.id === calendar.userId))
      fail('Unknown calendar owner.');
  for (const user of users) {
    const owned = calendars.filter((c) => c.userId === user.id);
    if (owned.length && owned.filter((c) => c.primary).length !== 1)
      fail('Each user with calendars must have exactly one primary calendar.');
  }
  const events = ((d.events ?? []) as unknown[]).map((e) => {
    const data = object(e);
    const c = calendars.find((c) => c.id === data.calendarId);
    if (!c) fail('Unknown event calendar.');
    return makeEvent(data, c, now);
  });
  const clients = ((d.clients ?? []) as unknown[]).map((v) => {
    const c = object(v);
    fields(c, ['id', 'secret', 'redirectUris']);
    if (!Array.isArray(c.redirectUris) || !c.redirectUris.length)
      fail('redirectUris must be a nonempty array.');
    const redirectUris = c.redirectUris.map((v) => {
      const text = string(v, 'redirect URI');
      let url: URL;
      try {
        url = new URL(text);
      } catch {
        return fail('Invalid redirect URI.');
      }
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.hash ||
        url.username ||
        url.password
      )
        fail('Invalid redirect URI.');
      return text;
    });
    return { id: id(c.id), secret: string(c.secret, 'secret'), redirectUris };
  });
  for (const rows of [users, calendars, clients])
    if (new Set(rows.map((v) => v.id)).size !== rows.length)
      fail('Duplicate fixture ID.');
  if (
    new Set(events.map((e) => JSON.stringify([e.calendarId, e.id]))).size !==
    events.length
  )
    fail('Duplicate event ID.');
  return { users, calendars, events, clients };
}
export const defaultFixture = {
  users: [
    { id: 'alex', name: 'Alex Morgan', email: 'alex@example.test' },
    { id: 'sam', name: 'Sam Rivera', email: 'sam@example.test' },
  ],
  calendars: [
    {
      id: 'alex-work',
      userId: 'alex',
      summary: 'Work calendar',
      timeZone: 'Asia/Tokyo',
      primary: true,
    },
    {
      id: 'alex-personal',
      userId: 'alex',
      summary: 'Personal',
      timeZone: 'Asia/Tokyo',
      primary: false,
    },
    {
      id: 'sam-work',
      userId: 'sam',
      summary: 'Work calendar',
      timeZone: 'America/New_York',
      primary: true,
    },
  ],
  events: [
    {
      id: 'planning',
      calendarId: 'alex-work',
      summary: 'Weekly planning',
      start: { dateTime: '2026-10-19T10:00:00+09:00' },
      end: { dateTime: '2026-10-19T11:00:00+09:00' },
    },
  ],
  clients: [
    {
      id: 'sample-app',
      secret: 'local-sample-secret',
      redirectUris: ['http://127.0.0.1:4175/callback'],
    },
  ],
};
