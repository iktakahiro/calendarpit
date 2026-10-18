import { fail } from '../../shared/errors';
import type { Calendar } from '../../model/directory';
import type { Workspace } from '../../workspace/workspace';
import { interval } from '../events/event-time';
import { notifyCalendarList, stopChannel } from '../watch/channel-operations';
import { isDefaultCalendarListSettings } from './calendar-list-entry';
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
 * a saved all-day event a non-positive duration. Making a calendar primary
 * puts it back on the owner's calendar list when `calendarList.delete` had
 * removed it, and keeps that entry's other settings.
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
    workspace.calendarListEntries = workspace.calendarListEntries.filter(
      (entry) => entry.calendarId !== c.id,
    );
    workspace.data.calendars.push(c);
  }
  keepPrimaryOnCalendarList(workspace, existing ?? c);
  workspace.touch();
  notifyCalendarList(workspace, c.userId);
  return { calendar: c, created: !existing };
}

/**
 * Deletes a calendar with its events and event watch channels, and keeps a
 * tombstone for `calendarList` with `showDeleted`. Per-user list settings for
 * that calendar are dropped. Calendar-list channels for the owner are
 * notified. When the primary calendar is deleted, another calendar that is
 * still on the owner's list becomes primary. If every remaining calendar was
 * removed from the list, the next owned calendar becomes primary and is put
 * back on the list, keeping its other list settings.
 */
export function deleteCalendar(workspace: Workspace, existing: Calendar) {
  workspace.deletedCalendars.push(structuredClone(existing));
  workspace.calendarListEntries = workspace.calendarListEntries.filter(
    (entry) => entry.calendarId !== existing.id,
  );
  workspace.data.calendars = workspace.data.calendars.filter(
    (c) => c !== existing,
  );
  workspace.data.events = workspace.data.events.filter(
    (e) => e.calendarId !== existing.id,
  );
  for (const c of workspace.channels.values())
    if (c.calendarId === existing.id) stopChannel(workspace, c);
  if (existing.primary) promoteNextPrimary(workspace, existing.userId);
  workspace.touch();
  notifyCalendarList(workspace, existing.userId);
}

/**
 * Chooses the next primary after the current one is deleted.
 *
 * A calendar that is still on the list is preferred, so unsubscribing from a
 * secondary calendar does not make it primary while another listed calendar
 * remains. When none remain listed, the first remaining calendar is promoted
 * and {@link keepPrimaryOnCalendarList} puts it back.
 */
function promoteNextPrimary(workspace: Workspace, userId: string) {
  const peers = workspace.data.calendars.filter((c) => c.userId === userId);
  const next = peers.find((c) => listedCalendar(workspace, c)) ?? peers[0];
  if (!next) return;
  next.primary = true;
  keepPrimaryOnCalendarList(workspace, next);
}

/** Whether `calendar` is still on its owner's calendar list. */
function listedCalendar(workspace: Workspace, calendar: Calendar) {
  return !workspace.calendarListEntries.some(
    (entry) =>
      entry.userId === calendar.userId &&
      entry.calendarId === calendar.id &&
      entry.removed,
  );
}

/**
 * Puts a primary calendar back on its owner's list.
 *
 * A missing record is already listed. Clearing `removed` keeps the other
 * per-user settings. The record is dropped when that leaves only defaults.
 */
function keepPrimaryOnCalendarList(workspace: Workspace, calendar: Calendar) {
  if (!calendar.primary) return;
  const index = workspace.calendarListEntries.findIndex(
    (entry) =>
      entry.userId === calendar.userId && entry.calendarId === calendar.id,
  );
  if (index < 0) return;
  const entry = workspace.calendarListEntries[index]!;
  if (!entry.removed) return;
  entry.removed = false;
  if (isDefaultCalendarListSettings(entry))
    workspace.calendarListEntries.splice(index, 1);
}
