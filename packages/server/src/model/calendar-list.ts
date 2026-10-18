/**
 * A default reminder on a calendar-list entry. These are configuration only;
 * Calendarpit does not send reminder email or popups.
 */
export type CalendarListReminder = {
  method: 'email' | 'popup';
  minutes: number;
};

/**
 * One calendar-list notification preference. `method` is always `email`
 * because that is the only method Google defines here. No email is sent.
 */
export type CalendarListNotification = {
  type:
    | 'eventCreation'
    | 'eventChange'
    | 'eventCancellation'
    | 'eventResponse'
    | 'agenda';
  method: 'email';
};

/**
 * Per-user settings for one calendar on that user's calendar list.
 *
 * A missing record means the owned calendar is on the list with the defaults
 * from `defaultCalendarListSettings`: selected, visible, and palette color
 * `1`. There is no sharing model, so `userId` is always the calendar owner.
 */
export type CalendarListSettings = {
  userId: string;
  calendarId: string;
  /** Display name chosen by this user. The calendar's own summary is unchanged. */
  summaryOverride?: string;
  /**
   * Palette id `1`–`24`. When custom RGB colors are stored, this is the
   * nearest palette background, as Google does for `colorRgbFormat`.
   */
  colorId: string;
  /** Custom background written with `colorRgbFormat`. Absent for palette colors. */
  backgroundColor?: string;
  /** Custom foreground written with `colorRgbFormat`. Absent for palette colors. */
  foregroundColor?: string;
  hidden: boolean;
  selected: boolean;
  defaultReminders: CalendarListReminder[];
  notificationSettings?: { notifications: CalendarListNotification[] };
  /**
   * Removed from the list by `calendarList.delete`. The calendar and its
   * events still exist. `get` returns 404; `list` includes the entry only
   * when `showDeleted=true`.
   */
  removed: boolean;
};
