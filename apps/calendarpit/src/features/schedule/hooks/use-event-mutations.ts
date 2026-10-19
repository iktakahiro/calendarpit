import { managementApi, segment } from '../../../lib/management-client';
import { useWorkspaceMutation } from '../../workspace/hooks/use-workspace-mutation';

const eventsPath = (calendarId: string) =>
  `/calendars${segment(calendarId)}/events`;

/** Creates an event, or replaces the event with `id`. */
export const useSaveEvent = () =>
  useWorkspaceMutation(
    ({
      calendarId,
      id,
      body,
    }: {
      calendarId: string;
      id?: string;
      body: unknown;
    }) =>
      managementApi(
        `${eventsPath(calendarId)}${id ? segment(id) : ''}`,
        id ? 'PUT' : 'POST',
        body,
      ),
    'schedule.eventSaved',
  );

/** Deletes an event. The server keeps it as a cancelled record for sync. */
export const useDeleteEvent = () =>
  useWorkspaceMutation(
    ({ calendarId, id }: { calendarId: string; id: string }) =>
      managementApi(`${eventsPath(calendarId)}${segment(id)}`, 'DELETE'),
    'schedule.eventDeleted',
  );
