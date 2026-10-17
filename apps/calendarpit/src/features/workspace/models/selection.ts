import type { Calendar, Snapshot, User } from '@calendarpit/server';
import type { WorkspaceSearch } from './workspace-search';

/** The user and calendar the admin UI is focused on. */
export type Selection = {
  user?: User;
  /** Calendars owned by `user`. */
  calendars: Calendar[];
  calendar?: Calendar;
};

/**
 * Resolves the selected user and calendar from search params. Unknown IDs fall
 * back to the first user and to that user's primary calendar, so stale links
 * still open something useful.
 */
export function resolveSelection(
  snapshot: Snapshot | undefined,
  search: WorkspaceSearch,
): Selection {
  const user =
    snapshot?.users.find((u) => u.id === search.user) ?? snapshot?.users[0];
  const calendars =
    snapshot?.calendars.filter((c) => c.userId === user?.id) ?? [];
  const calendar =
    calendars.find((c) => c.id === search.calendar) ??
    calendars.find((c) => c.primary) ??
    calendars[0];
  return { user, calendars, calendar };
}
