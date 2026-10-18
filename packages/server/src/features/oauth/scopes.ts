/** Full Calendar access. Most scope groups below include it. */
export const calendarScope = 'https://www.googleapis.com/auth/calendar';

/** Write access to the caller's calendar list, without the rest of Calendar. */
export const calendarListScope = `${calendarScope}.calendarlist`;

/** Every scope a client may request. Others are rejected as `invalid_scope`. */
export const scopes = [
  calendarScope,
  `${calendarScope}.readonly`,
  `${calendarScope}.events`,
  `${calendarScope}.events.readonly`,
  calendarListScope,
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

/** Scopes that allow reading events and creating event watch channels. */
export const readEvents = [
  calendarScope,
  `${calendarScope}.readonly`,
  `${calendarScope}.events`,
  `${calendarScope}.events.readonly`,
];

/** Scopes that allow changing events. */
export const writeEvents = [calendarScope, `${calendarScope}.events`];

/** Scopes that allow `calendars.get`. */
export const readCalendars = [
  calendarScope,
  `${calendarScope}.readonly`,
  `${calendarScope}.calendars.readonly`,
];

/**
 * Scopes that allow `calendarList.list`, `calendarList.get`, and
 * `calendarList.watch`. `calendar.app.created` is not accepted.
 */
export const readCalendarList = [
  calendarScope,
  `${calendarScope}.readonly`,
  calendarListScope,
  `${calendarScope}.calendarlist.readonly`,
];

/**
 * Scopes that allow `calendarList.insert`, `patch`, `update`, and `delete`.
 * `calendar.app.created` is not accepted.
 */
export const writeCalendarList = [calendarScope, calendarListScope];

/**
 * Scopes that allow `channels.stop` for a channel this grant created. Event
 * watches use {@link readEvents}; calendar-list watches use
 * {@link readCalendarList}.
 */
export const stopChannels = [
  ...readEvents,
  calendarListScope,
  `${calendarScope}.calendarlist.readonly`,
];

/** Scopes that allow `freebusy.query`. */
export const readFreeBusy = [
  ...readEvents,
  `${calendarScope}.freebusy`,
  `${calendarScope}.events.freebusy`,
];

/** Scopes that allow the OpenID `userinfo` endpoint. */
export const readUserInfo = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

/** Whether a grant includes the `email` claim scope. */
export const allowsEmail = (granted: string[]) =>
  granted.some((s) => s === 'email' || s.endsWith('/userinfo.email'));

/** Whether a grant includes the `profile` claim scope. */
export const allowsProfile = (granted: string[]) =>
  granted.some((s) => s === 'profile' || s.endsWith('/userinfo.profile'));
