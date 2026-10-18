import { isDeepStrictEqual } from 'node:util';
import { fail } from '../../shared/errors';
import type { CalendarListSettings } from '../../model/calendar-list';
import type { Calendar } from '../../model/directory';
import type { Workspace } from '../../workspace/workspace';
import { notifyCalendarList } from '../watch/channel-operations';
import { findCalendar } from './calendar-operations';
import {
  calendarListEntry,
  defaultCalendarListSettings,
  isDefaultCalendarListSettings,
  writeCalendarListSettings,
  type CalendarListEntryResource,
} from './calendar-list-entry';

/** Filters for `calendarList.list`. Every entry still has the owner role. */
export type CalendarListQuery = {
  showDeleted: boolean;
  showHidden: boolean;
};

/**
 * Stored list settings, or the default entry when the user has not customized
 * this calendar.
 */
export function calendarListSettings(
  workspace: Workspace,
  userId: string,
  calendarId: string,
): CalendarListSettings {
  return (
    workspace.calendarListEntries.find(
      (entry) => entry.userId === userId && entry.calendarId === calendarId,
    ) ?? defaultCalendarListSettings(userId, calendarId)
  );
}

/**
 * Lists the caller's calendar-list entries.
 *
 * Owned calendars start on the list. Hidden entries are omitted unless
 * `showHidden` is set. `showDeleted` adds entries removed with
 * `calendarList.delete` and tombstones of calendars deleted through the
 * management API. Another user's calendars are absent.
 */
export function listCalendarEntries(
  workspace: Workspace,
  userId: string,
  query: CalendarListQuery,
): CalendarListEntryResource[] {
  const rows: CalendarListEntryResource[] = [];
  for (const calendar of workspace.data.calendars) {
    if (calendar.userId !== userId) continue;
    const settings = calendarListSettings(workspace, userId, calendar.id);
    if (settings.removed) {
      if (query.showDeleted)
        rows.push(calendarListEntry(calendar, settings, true));
      continue;
    }
    if (settings.hidden && !query.showHidden) continue;
    rows.push(calendarListEntry(calendar, settings));
  }
  if (query.showDeleted) {
    for (const calendar of workspace.deletedCalendars)
      if (calendar.userId === userId)
        rows.push(
          calendarListEntry(
            calendar,
            defaultCalendarListSettings(userId, calendar.id),
            true,
          ),
        );
  }
  return rows;
}

/**
 * Returns one calendar from the caller's list.
 *
 * @param calendarId - Calendar id or `primary`.
 * @throws {@link ApiError} 404 `notFound` when the calendar is missing, owned
 * by someone else, or removed from the list.
 */
export function getCalendarListEntry(
  workspace: Workspace,
  userId: string,
  calendarId: string,
): CalendarListEntryResource {
  const calendar = requireListedCalendar(workspace, userId, calendarId);
  return calendarListEntry(
    calendar,
    calendarListSettings(workspace, userId, calendar.id),
  );
}

/**
 * Restores an owned calendar that was removed from the caller's list.
 *
 * A calendar that is already listed, including a hidden one, is a duplicate:
 * unhide it with patch. This does not create a calendar. Unknown and unowned
 * calendars are `404`, the same response as other calendar probes.
 *
 * @throws {@link ApiError} 400 for an invalid body, 404 `notFound`, or 409
 * `duplicate`.
 */
export function insertCalendarListEntry(
  workspace: Workspace,
  userId: string,
  input: Record<string, unknown>,
  colorRgbFormat: boolean,
): CalendarListEntryResource {
  if (typeof input.id !== 'string' || !input.id.trim()) fail('id is required.');
  const calendar = findCalendar(workspace, input.id, userId);
  const current = calendarListSettings(workspace, userId, calendar.id);
  if (!current.removed)
    fail('Calendar already exists in the calendar list.', 409, 'duplicate');
  return commit(
    workspace,
    calendar,
    writeCalendarListSettings({
      calendar,
      current,
      input,
      patch: false,
      restore: true,
      colorRgbFormat,
      acceptedIds: [calendar.id, input.id],
    }),
  );
}

/**
 * Patches one listed calendar. Omitted writable fields stay as they are.
 *
 * @throws {@link ApiError} 400 for an invalid body, or 404 `notFound`.
 */
export function patchCalendarListEntry(
  workspace: Workspace,
  userId: string,
  calendarId: string,
  input: Record<string, unknown>,
  colorRgbFormat: boolean,
): CalendarListEntryResource {
  return change(workspace, userId, calendarId, input, true, colorRgbFormat);
}

/**
 * Replaces the writable fields of one listed calendar.
 *
 * @throws {@link ApiError} 400 for an invalid body, or 404 `notFound`.
 */
export function updateCalendarListEntry(
  workspace: Workspace,
  userId: string,
  calendarId: string,
  input: Record<string, unknown>,
  colorRgbFormat: boolean,
): CalendarListEntryResource {
  return change(workspace, userId, calendarId, input, false, colorRgbFormat);
}

/**
 * Removes a non-primary calendar from the caller's list. The calendar and its
 * events stay. The primary calendar cannot leave the list.
 *
 * @throws {@link ApiError} 403 `cannotDeletePrimaryCalendar` for the primary
 * calendar, or 404 `notFound` when it is missing or already removed.
 */
export function deleteCalendarListEntry(
  workspace: Workspace,
  userId: string,
  calendarId: string,
) {
  const calendar = requireListedCalendar(workspace, userId, calendarId);
  if (calendar.primary)
    fail(
      'Cannot remove the primary calendar from the calendar list.',
      403,
      'cannotDeletePrimaryCalendar',
    );
  const current = calendarListSettings(workspace, userId, calendar.id);
  commit(workspace, calendar, { ...current, removed: true });
}

function change(
  workspace: Workspace,
  userId: string,
  calendarId: string,
  input: Record<string, unknown>,
  patch: boolean,
  colorRgbFormat: boolean,
) {
  const calendar = requireListedCalendar(workspace, userId, calendarId);
  const current = calendarListSettings(workspace, userId, calendar.id);
  return commit(
    workspace,
    calendar,
    writeCalendarListSettings({
      calendar,
      current,
      input,
      patch,
      colorRgbFormat,
      acceptedIds: [calendar.id, calendarId],
    }),
  );
}

function requireListedCalendar(
  workspace: Workspace,
  userId: string,
  calendarId: string,
): Calendar {
  const calendar = findCalendar(workspace, calendarId, userId);
  if (calendarListSettings(workspace, userId, calendar.id).removed)
    fail('Calendar not found.', 404, 'notFound');
  return calendar;
}

/**
 * Saves `settings` when they differ from the stored entry, then notifies
 * calendar-list channels. Default settings are stored by deleting the record.
 *
 * @returns The wire entry after the save.
 */
function commit(
  workspace: Workspace,
  calendar: Calendar,
  settings: CalendarListSettings,
): CalendarListEntryResource {
  const index = workspace.calendarListEntries.findIndex(
    (entry) =>
      entry.userId === settings.userId &&
      entry.calendarId === settings.calendarId,
  );
  const previous =
    index >= 0 ? workspace.calendarListEntries[index] : undefined;
  const before =
    previous ??
    defaultCalendarListSettings(settings.userId, settings.calendarId);
  if (!isDeepStrictEqual(before, settings)) {
    if (isDefaultCalendarListSettings(settings)) {
      if (index >= 0) workspace.calendarListEntries.splice(index, 1);
    } else if (index >= 0) workspace.calendarListEntries[index] = settings;
    else workspace.calendarListEntries.push(settings);
    workspace.touch();
    notifyCalendarList(workspace, settings.userId);
  }
  return calendarListEntry(calendar, settings, settings.removed);
}
