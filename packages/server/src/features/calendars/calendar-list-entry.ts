import { isDeepStrictEqual } from 'node:util';
import { fail } from '../../shared/errors';
import { fields, object, string } from '../../shared/validation';
import type {
  CalendarListNotification,
  CalendarListReminder,
  CalendarListSettings,
} from '../../model/calendar-list';
import type { Calendar } from '../../model/directory';
import {
  calendarColor,
  defaultCalendarColorId,
  nearestCalendarColorId,
} from './calendar-colors';

/**
 * Conferencing advertised on every calendar-list entry. Only the synthetic
 * `hangoutsMeet` solution exists; the value is not configurable.
 */
export const calendarListConferenceProperties = {
  allowedConferenceSolutionTypes: ['hangoutsMeet'],
};

const notificationTypes = [
  'eventCreation',
  'eventChange',
  'eventCancellation',
  'eventResponse',
  'agenda',
] as const;

const writableFields = [
  'summaryOverride',
  'colorId',
  'backgroundColor',
  'foregroundColor',
  'hidden',
  'selected',
  'defaultReminders',
  'notificationSettings',
];

const echoedFields = [
  'kind',
  'etag',
  'id',
  'summary',
  'timeZone',
  'accessRole',
  'primary',
  'deleted',
  'conferenceProperties',
];

/**
 * Settings for an owned calendar that has never been customized and has not
 * been removed from the list. `selected` is true so the calendar stays visible,
 * matching Calendarpit's previous `calendarList.list` responses. Google's
 * field reference documents `false` as the PUT default; {@link writeCalendarListSettings}
 * uses that default when a replace omits `selected`.
 */
export function defaultCalendarListSettings(
  userId: string,
  calendarId: string,
): CalendarListSettings {
  return {
    userId,
    calendarId,
    colorId: defaultCalendarColorId,
    hidden: false,
    selected: true,
    defaultReminders: [],
    removed: false,
  };
}

/**
 * Whether `settings` can be omitted from storage because a missing record
 * already means the same thing.
 */
export function isDefaultCalendarListSettings(
  settings: CalendarListSettings,
): boolean {
  return isDeepStrictEqual(
    settings,
    defaultCalendarListSettings(settings.userId, settings.calendarId),
  );
}

/** Colors a list entry returns, using the palette unless custom RGB is stored. */
export function displayedCalendarColors(
  settings: Pick<
    CalendarListSettings,
    'colorId' | 'backgroundColor' | 'foregroundColor'
  >,
) {
  const known = calendarColor(settings.colorId);
  const palette = known ?? calendarColor(defaultCalendarColorId)!;
  return {
    colorId: known ? settings.colorId : defaultCalendarColorId,
    backgroundColor: settings.backgroundColor ?? palette.background,
    foregroundColor: settings.foregroundColor ?? palette.foreground,
  };
}

/** A `calendar#calendarListEntry` response body. */
export type CalendarListEntryResource = {
  kind: 'calendar#calendarListEntry';
  etag: string;
  id: string;
  summary: string;
  summaryOverride?: string;
  timeZone: string;
  colorId: string;
  backgroundColor: string;
  foregroundColor: string;
  hidden?: true;
  selected: boolean;
  accessRole: 'owner';
  defaultReminders: CalendarListReminder[];
  notificationSettings?: CalendarListSettings['notificationSettings'];
  primary: boolean;
  deleted?: true;
  conferenceProperties: typeof calendarListConferenceProperties;
};

function quotedHash(value: unknown) {
  const hex = new Bun.CryptoHasher('sha256')
    .update(JSON.stringify(value))
    .digest('hex')
    .slice(0, 16);
  return `"${hex}"`;
}

/**
 * Builds the Google calendar-list entry for one calendar.
 *
 * @param deleted - Set for a list removal or a deleted-calendar tombstone.
 * `hidden` is omitted when false, matching Google. Description and location
 * are omitted because calendars do not store them.
 */
export function calendarListEntry(
  calendar: Calendar,
  settings: CalendarListSettings,
  deleted = false,
): CalendarListEntryResource {
  const colors = displayedCalendarColors(settings);
  const etag = quotedHash({
    id: calendar.id,
    summary: calendar.summary,
    timeZone: calendar.timeZone,
    primary: calendar.primary,
    summaryOverride: settings.summaryOverride ?? null,
    colorId: colors.colorId,
    backgroundColor: settings.backgroundColor ?? null,
    foregroundColor: settings.foregroundColor ?? null,
    hidden: settings.hidden,
    selected: settings.selected,
    defaultReminders: settings.defaultReminders,
    notificationSettings: settings.notificationSettings ?? null,
    deleted,
  });
  return {
    kind: 'calendar#calendarListEntry',
    etag,
    id: calendar.id,
    summary: calendar.summary,
    ...(settings.summaryOverride
      ? { summaryOverride: settings.summaryOverride }
      : {}),
    timeZone: calendar.timeZone,
    ...colors,
    ...(settings.hidden ? { hidden: true as const } : {}),
    selected: settings.selected,
    accessRole: 'owner',
    defaultReminders: settings.defaultReminders,
    ...(settings.notificationSettings
      ? { notificationSettings: settings.notificationSettings }
      : {}),
    primary: calendar.primary,
    ...(deleted ? { deleted: true as const } : {}),
    conferenceProperties: calendarListConferenceProperties,
  };
}

/**
 * ETag of a calendar-list collection page's full row set, before paging.
 * It changes when any returned entry's etag changes.
 */
export function calendarListEtag(entries: CalendarListEntryResource[]) {
  return quotedHash(entries.map((entry) => entry.etag));
}

/** Input of {@link writeCalendarListSettings}. */
export type CalendarListWrite = {
  calendar: Calendar;
  /** Settings echoed read-only fields are compared against. */
  current: CalendarListSettings;
  input: Record<string, unknown>;
  /** PATCH merges. PUT and insert replace writable fields. */
  patch: boolean;
  /**
   * Insert starts from defaults and clears `removed`, while read-only echoes
   * are still compared with `current` (the removed entry).
   */
  restore?: boolean;
  /** Google's `colorRgbFormat` query parameter. */
  colorRgbFormat: boolean;
  /**
   * Ids that may appear in the body. Includes the real calendar id and, when
   * the caller used it, the `primary` alias.
   */
  acceptedIds: string[];
};

/**
 * Applies a calendar-list insert, patch, or update to `current`.
 *
 * PATCH keeps omitted writable fields. PUT and insert replace them: omitted
 * `summaryOverride`, reminders, and notifications are cleared, `hidden` becomes
 * false, `selected` becomes false, and `colorId` returns to palette `1` unless
 * a color was supplied. `null` clears `summaryOverride`, `defaultReminders`,
 * and `notificationSettings`. An empty `notificationSettings` object leaves
 * the notifications array unchanged, because that array was not specified.
 * Read-only fields may be echoed only when they equal the current entry, so a
 * client can send a resource it just fetched. Repeating the current `colorId`
 * with the stored RGB colors is the same kind of echo.
 *
 * With `colorRgbFormat`, both RGB colors are required and a supplied `colorId`
 * is ignored. Google's reference says the flag sets `colorId` to the nearest
 * palette color automatically.
 *
 * @throws {@link ApiError} 400 when a field is unknown, read-only and different,
 * or an invalid color, reminder, or notification. `backgroundColor` and
 * `foregroundColor` require `colorRgbFormat` unless they echo stored colors.
 */
export function writeCalendarListSettings({
  calendar,
  current,
  input,
  patch,
  restore = false,
  colorRgbFormat,
  acceptedIds,
}: CalendarListWrite): CalendarListSettings {
  fields(input, [...writableFields, ...echoedFields]);
  assertEchoes(calendar, current, input, acceptedIds);
  const next: CalendarListSettings =
    patch && !restore
      ? structuredClone(current)
      : {
          userId: current.userId,
          calendarId: calendar.id,
          colorId: defaultCalendarColorId,
          hidden: false,
          selected: false,
          defaultReminders: [],
          removed: restore ? false : current.removed,
        };
  if ('summaryOverride' in input) applyOverride(next, input.summaryOverride);
  if ('hidden' in input) next.hidden = booleanField(input.hidden, 'hidden');
  if ('selected' in input)
    next.selected = booleanField(input.selected, 'selected');
  if ('defaultReminders' in input)
    next.defaultReminders = reminders(input.defaultReminders);
  if ('notificationSettings' in input)
    applyNotifications(next, input.notificationSettings);
  applyColors(next, input, patch && !restore, colorRgbFormat);
  return next;
}

function assertEchoes(
  calendar: Calendar,
  current: CalendarListSettings,
  input: Record<string, unknown>,
  acceptedIds: string[],
) {
  const entry = calendarListEntry(calendar, current, current.removed);
  if (input.kind !== undefined && input.kind !== entry.kind)
    fail('kind is read-only.');
  if (input.etag !== undefined && input.etag !== entry.etag)
    fail('etag does not match this calendar list entry.');
  if (input.id !== undefined && !acceptedIds.includes(String(input.id)))
    fail('id does not match this calendar.');
  if (input.summary !== undefined && input.summary !== calendar.summary)
    fail('summary is read-only.');
  if (input.timeZone !== undefined && input.timeZone !== calendar.timeZone)
    fail('timeZone is read-only.');
  if (input.accessRole !== undefined && input.accessRole !== 'owner')
    fail('accessRole is read-only.');
  if (input.primary !== undefined && input.primary !== calendar.primary)
    fail('primary is read-only.');
  if (input.deleted !== undefined && input.deleted !== (entry.deleted === true))
    fail('deleted is read-only.');
  if (
    input.conferenceProperties !== undefined &&
    !isDeepStrictEqual(
      input.conferenceProperties,
      calendarListConferenceProperties,
    )
  )
    fail('conferenceProperties is read-only.');
}

function applyOverride(settings: CalendarListSettings, value: unknown) {
  if (value === null) {
    delete settings.summaryOverride;
    return;
  }
  settings.summaryOverride = string(value, 'summaryOverride');
}

function booleanField(value: unknown, name: string) {
  if (typeof value !== 'boolean') fail(`${name} must be boolean.`);
  return value;
}

function reminders(value: unknown): CalendarListReminder[] {
  if (value === null) return [];
  if (!Array.isArray(value) || value.length > 5)
    fail('At most five default reminders are supported.');
  return value.map((item) => {
    const reminder = object(item);
    fields(reminder, ['method', 'minutes']);
    if (
      !['email', 'popup'].includes(String(reminder.method)) ||
      !Number.isInteger(reminder.minutes) ||
      Number(reminder.minutes) < 0 ||
      Number(reminder.minutes) > 40320
    )
      fail('Invalid default reminder.');
    return {
      method: reminder.method as CalendarListReminder['method'],
      minutes: Number(reminder.minutes),
    };
  });
}

function applyNotifications(settings: CalendarListSettings, value: unknown) {
  if (value === null) {
    delete settings.notificationSettings;
    return;
  }
  const body = object(value);
  fields(body, ['notifications']);
  // Patch replaces an array only when the request specifies it. An empty
  // notificationSettings object therefore leaves the stored list unchanged.
  if (body.notifications === undefined) return;
  if (!Array.isArray(body.notifications) || body.notifications.length > 5)
    fail('At most five calendar notifications are supported.');
  const notifications = body.notifications.map((item) => {
    const notification = object(item);
    fields(notification, ['type', 'method']);
    if (
      !notificationTypes.includes(
        notification.type as (typeof notificationTypes)[number],
      ) ||
      notification.method !== 'email'
    )
      fail('Invalid calendar notification.');
    return {
      type: notification.type as CalendarListNotification['type'],
      method: 'email' as const,
    };
  });
  if (
    new Set(notifications.map((item) => item.type)).size !==
    notifications.length
  )
    fail('Duplicate calendar notification type.');
  if (notifications.length) settings.notificationSettings = { notifications };
  else delete settings.notificationSettings;
}

function hexColor(value: unknown, name: string) {
  if (typeof value !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(value))
    fail(`${name} must be a #rrggbb color.`);
  return value.toLowerCase();
}

function applyColors(
  settings: CalendarListSettings,
  input: Record<string, unknown>,
  patch: boolean,
  colorRgbFormat: boolean,
) {
  if (colorRgbFormat) {
    if (
      input.backgroundColor === undefined ||
      input.foregroundColor === undefined
    )
      fail('colorRgbFormat=true requires backgroundColor and foregroundColor.');
    const backgroundColor = hexColor(input.backgroundColor, 'backgroundColor');
    const foregroundColor = hexColor(input.foregroundColor, 'foregroundColor');
    // Google's colorRgbFormat parameter sets colorId automatically. A stale
    // or unknown colorId in the same body is ignored.
    settings.colorId = nearestCalendarColorId(backgroundColor);
    settings.backgroundColor = backgroundColor;
    settings.foregroundColor = foregroundColor;
    return;
  }
  const mentionsColor =
    input.colorId !== undefined ||
    input.backgroundColor !== undefined ||
    input.foregroundColor !== undefined;
  if (mentionsColor && colorsEcho(settings, input)) return;
  if ('colorId' in input) {
    if (typeof input.colorId !== 'string' || !calendarColor(input.colorId))
      fail('Invalid calendar colorId.');
    settings.colorId = input.colorId;
    delete settings.backgroundColor;
    delete settings.foregroundColor;
  } else if (!patch) {
    settings.colorId = defaultCalendarColorId;
    delete settings.backgroundColor;
    delete settings.foregroundColor;
  }
  const displayed = displayedCalendarColors(settings);
  if (
    input.backgroundColor !== undefined &&
    !sameColor(input.backgroundColor, displayed.backgroundColor)
  )
    fail('Set colorRgbFormat=true to write backgroundColor.');
  if (
    input.foregroundColor !== undefined &&
    !sameColor(input.foregroundColor, displayed.foregroundColor)
  )
    fail('Set colorRgbFormat=true to write foregroundColor.');
}

function sameColor(value: unknown, expected: string) {
  return typeof value === 'string' && value.toLowerCase() === expected;
}

/** Whether the color fields in `input` only repeat what `settings` already shows. */
function colorsEcho(
  settings: CalendarListSettings,
  input: Record<string, unknown>,
) {
  const current = displayedCalendarColors(settings);
  return (
    (input.colorId === undefined || input.colorId === current.colorId) &&
    (input.backgroundColor === undefined ||
      sameColor(input.backgroundColor, current.backgroundColor)) &&
    (input.foregroundColor === undefined ||
      sameColor(input.foregroundColor, current.foregroundColor))
  );
}
