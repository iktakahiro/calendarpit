/**
 * `@calendarpit/server`: a local, Google-compatible Calendar API and OAuth
 * server for development and repeatable tests.
 *
 * Use {@link createCalendarpit} to embed an isolated instance and pass Web
 * `Request` objects to its `handle` method.
 *
 * @packageDocumentation
 */
export { createCalendarpit, type Calendarpit } from './app';
export {
  Workspace,
  type WorkspaceOptions,
  type WorkspaceSignal,
} from './workspace/workspace';
export { resolveDatabase } from './workspace/persistence';
export { defaultFixture, parseFixture } from './features/fixtures/fixture';
export { redact } from './features/history/redaction';
export {
  VERSION,
  getServerStatus,
  type ServerStatus,
} from './features/status/server-status';
export type { Snapshot } from './features/status/snapshot-operations';
export type { RateLimitMode } from './model/rate-limit';
export {
  parseRateLimitMode,
  rateLimitBudgets,
  type RateLimitBudgets,
} from './features/quota/rate-limit';
export type { Calendar, User } from './model/directory';
export type {
  Attendee,
  CalendarEvent,
  Conference,
  EventTime,
  Person,
  Reminders,
} from './model/event';
export type { Fixture } from './model/fixture';
export type { History } from './model/history';
export type { Notification } from './model/notification';
export type { Client, Grant } from './model/oauth';
export type { Delivery, DeliveryFailure } from './model/watch';
