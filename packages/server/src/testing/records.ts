import type { Calendar, User } from '../model/directory';
import type { CalendarEvent } from '../model/event';
import { makeEvent } from '../features/events/event-input';

/** A test user that owns {@link calendarIn} calendars. */
export const owner: User = {
  id: 'owner',
  name: 'Owner',
  email: 'owner@example.test',
};

/** Returns a primary calendar in `timeZone`, owned by {@link owner}. */
export function calendarIn(timeZone: string): Calendar {
  return {
    id: 'calendar',
    userId: owner.id,
    summary: 'Calendar',
    timeZone,
    primary: true,
  };
}

/**
 * Builds a validated event through {@link makeEvent}, so tests use the same
 * normalization as the API. `now` is fixed at the Unix epoch.
 */
export function eventIn(
  calendar: Calendar,
  input: Record<string, unknown>,
): CalendarEvent {
  return makeEvent({ id: 'event', ...input }, calendar, 0);
}
