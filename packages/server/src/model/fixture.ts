import type { Calendar, User } from './directory';
import type { CalendarEvent } from './event';
import type { Client } from './oauth';

/**
 * The calendar data of a workspace. A fixture file has this shape; the startup
 * fixture is also the target of a reset.
 */
export type Fixture = {
  users: User[];
  calendars: Calendar[];
  events: CalendarEvent[];
  clients: Client[];
};
