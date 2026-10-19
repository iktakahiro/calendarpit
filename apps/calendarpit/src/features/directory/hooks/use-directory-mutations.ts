import type { Calendar, User } from '@calendarpit/server';
import { managementApi, segment } from '../../../lib/management-client';
import { useWorkspaceMutation } from '../../workspace/hooks/use-workspace-mutation';
import type {
  CalendarFormValues,
  UserFormValues,
} from '../models/directory-forms';

/** Creates a user, or updates the user with `id`. */
export const useSaveUser = () =>
  useWorkspaceMutation(
    ({ id, values }: { id?: string; values: UserFormValues }) =>
      managementApi<User>(
        `/users${id ? segment(id) : ''}`,
        id ? 'PATCH' : 'POST',
        values,
      ),
    'directory.user.saved',
  );

/** Deletes a user with their calendars, events, and connections. */
export const useDeleteUser = () =>
  useWorkspaceMutation(
    (id: string) => managementApi(`/users${segment(id)}`, 'DELETE'),
    'directory.user.deleted',
  );

/** Creates a calendar for `userId`, or updates the calendar with `id`. */
export const useSaveCalendar = () =>
  useWorkspaceMutation(
    ({
      id,
      userId,
      values,
    }: {
      id?: string;
      userId?: string;
      values: CalendarFormValues;
    }) =>
      managementApi<Calendar>(
        `/calendars${id ? segment(id) : ''}`,
        id ? 'PATCH' : 'POST',
        id ? values : { ...values, userId },
      ),
    'directory.calendar.saved',
  );

/** Deletes a calendar with its events and watch channels. */
export const useDeleteCalendar = () =>
  useWorkspaceMutation(
    (id: string) => managementApi(`/calendars${segment(id)}`, 'DELETE'),
    'directory.calendar.deleted',
  );
