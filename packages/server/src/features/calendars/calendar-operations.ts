import { fail } from '../../shared/errors';
import type { Calendar } from '../../model/directory';
import type { Workspace } from '../../workspace/workspace';
import { interval } from '../events/event-time';
import { stopChannel } from '../watch/channel-operations';
import { makeCalendar } from './calendar-input';

/**
 * Finds a calendar by ID, or the user's primary calendar for `primary`.
 *
 * @param userId - Restricts the lookup to this owner, as for Google API
 * callers. Without it, `primary` matches nothing.
 * @throws {@link ApiError} 404 `notFound`, including for another user's
 * calendar, so callers cannot probe IDs.
 */
export function findCalendar(
  workspace: Workspace,
  calendarId: string,
  userId?: string,
): Calendar {
  const c = workspace.data.calendars.find((c) =>
    calendarId === 'primary'
      ? c.primary && c.userId === userId
      : c.id === calendarId,
  );
  if (!c || (userId && c.userId !== userId))
    fail('Calendar not found.', 404, 'notFound');
  return c;
}

/**
 * Creates a calendar, or updates `existing` with the fields in `input`.
 *
 * Keeps the primary invariant: a user's first calendar becomes primary,
 * making another calendar primary demotes the old one, and the primary flag
 * cannot simply be removed. A time zone change is refused when it would give
 * a saved all-day event a non-positive duration.
 *
 * @returns The saved calendar and whether it was created.
 * @throws {@link ApiError} 400 for invalid or immutable fields, an unknown
 * owner, or an invalidating time zone; 409 `duplicate` for an existing ID.
 */
export function saveCalendar(
  workspace: Workspace,
  input: Record<string, unknown>,
  existing?: Calendar,
) {
  if (
    existing &&
    ((input.id !== undefined && input.id !== existing.id) ||
      (input.userId !== undefined && input.userId !== existing.userId))
  )
    fail('Calendar ID and owner are immutable.');
  const c = makeCalendar({ ...existing, ...input });
  if (!workspace.data.users.some((u) => u.id === c.userId))
    fail('Unknown owner.');
  if (!existing && workspace.data.calendars.some((other) => other.id === c.id))
    fail('Duplicate calendar ID.', 409, 'duplicate');
  const peers = workspace.data.calendars.filter(
    (other) => other.userId === c.userId && other.id !== c.id,
  );
  if (!peers.length) c.primary = true;
  if (existing?.primary && !c.primary)
    fail('Choose another calendar as primary first.');
  // Changing the zone must not invalidate saved all-day intervals.
  for (const e of workspace.data.events.filter((e) => e.calendarId === c.id)) {
    const [a, b] = interval(e, c);
    if (b <= a) fail('The new time zone invalidates a saved event.');
  }
  if (c.primary) for (const peer of peers) peer.primary = false;
  if (existing) Object.assign(existing, c);
  else {
    workspace.deletedCalendars = workspace.deletedCalendars.filter(
      (removed) => removed.id !== c.id,
    );
    workspace.data.calendars.push(c);
  }
  workspace.touch();
  return { calendar: c, created: !existing };
}

/**
 * Deletes a calendar with its events and watch channels, and keeps a
 * tombstone for `calendarList` with `showDeleted`. When the primary calendar
 * is deleted, the owner's next calendar becomes primary.
 */
export function deleteCalendar(workspace: Workspace, existing: Calendar) {
  workspace.deletedCalendars.push(structuredClone(existing));
  workspace.data.calendars = workspace.data.calendars.filter(
    (c) => c !== existing,
  );
  workspace.data.events = workspace.data.events.filter(
    (e) => e.calendarId !== existing.id,
  );
  for (const c of workspace.channels.values())
    if (c.calendarId === existing.id) stopChannel(workspace, c);
  if (existing.primary) {
    const next = workspace.data.calendars.find(
      (c) => c.userId === existing.userId,
    );
    if (next) next.primary = true;
  }
  workspace.touch();
}
