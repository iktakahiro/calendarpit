/** A local test identity. Calendarpit has no passwords; consent picks a user. */
export type User = {
  /** Stable ID, also used in management URLs. */
  id: string;
  /** Display name shown on the consent page and as the event organizer name. */
  name: string;
  /** Email address used for attendee matching and the `userinfo` claim. */
  email: string;
};

/**
 * A calendar owned by one user. Each user with calendars has exactly one
 * primary calendar, which Google clients address as `primary`.
 */
export type Calendar = {
  id: string;
  /** ID of the owning {@link User}. Immutable after creation. */
  userId: string;
  summary: string;
  /** IANA time zone used for all-day events and default event output. */
  timeZone: string;
  primary: boolean;
};
