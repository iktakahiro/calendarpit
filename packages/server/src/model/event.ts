/**
 * The start or end of an event, as in Google's `EventDateTime`. Exactly one of
 * `date` (all-day) and `dateTime` (timed) is set.
 */
export type EventTime = {
  /** All-day date in `YYYY-MM-DD` form. */
  date?: string;
  /** RFC 3339 date-time. Stored with an offset once validated. */
  dateTime?: string;
  /** IANA zone. Required for recurring timed events. */
  timeZone?: string;
};

/** A person reference, as in Google's event `organizer` and `creator`. */
export type Person = { email: string; displayName?: string; self?: boolean };

/** An event attendee and their RSVP state. */
export type Attendee = Person & {
  responseStatus: 'needsAction' | 'declined' | 'tentative' | 'accepted';
  organizer?: boolean;
  optional?: boolean;
  resource?: boolean;
  comment?: string;
  additionalGuests?: number;
};

/** Reminder settings. Overrides are allowed only when `useDefault` is false. */
export type Reminders = {
  useDefault: boolean;
  overrides?: { method: 'email' | 'popup'; minutes: number }[];
};

/**
 * Conference data. Only synthetic `hangoutsMeet` conferences are supported;
 * their URIs use the reserved `.invalid` domain.
 */
export type Conference = {
  createRequest?: {
    requestId: string;
    conferenceSolutionKey?: { type: 'hangoutsMeet' };
    status?: { statusCode: 'success' };
  };
  conferenceId?: string;
  conferenceSolution?: {
    key: { type: 'hangoutsMeet' };
    name: string;
  };
  entryPoints?: { entryPointType: 'video'; uri: string; label?: string }[];
};

/**
 * A stored event in Google's `Event` resource shape, plus `calendarId`, which
 * Google responses omit. Recurring series store their rules in `recurrence`.
 * Modified or cancelled occurrences are separate records that carry
 * `recurringEventId` and `originalStartTime`.
 */
export type CalendarEvent = {
  id: string;
  /** Owning calendar. Not part of Google's wire format. */
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
  /** Incremented on every change; used for invitation ordering. */
  sequence?: number;
  conferenceData?: Conference;
  hangoutLink?: string;
  /** RRULE, EXRULE, RDATE, and EXDATE lines of a recurring series. */
  recurrence?: string[];
  recurringEventId?: string;
  originalStartTime?: EventTime;
  extendedProperties?: {
    private?: Record<string, string>;
    shared?: Record<string, string>;
  };
  created: string;
  updated: string;
  /** Quoted opaque version tag. Changes on every write. */
  etag: string;
};
