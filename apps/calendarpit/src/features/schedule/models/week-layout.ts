import type { CalendarEvent } from '@calendarpit/server';
import { shiftDate } from './dates';
import { eventsOn, placeEvents, type PlacedEvent } from './day-layout';

/** Days in a week, the width of the week grid. */
export const weekLength = 7;

/** Minutes in a slot of the week grid, the granularity of a click. */
export const slotMinutes = 30;

/** One day column of the week grid. */
export type WeekDay = {
  /** The day, `YYYY-MM-DD`. */
  date: string;
  /** All-day events overlapping the day. */
  allDay: CalendarEvent[];
  /** Timed events, positioned on the day's own track. */
  timed: PlacedEvent[];
  /** Lanes the day's overlapping events need, at least one. */
  lanes: number;
};

/**
 * Returns the date the week containing `date` starts on.
 *
 * @param weekStartsOn Day the week starts on, `0` for Sunday.
 */
export function weekStart(date: string, weekStartsOn = 0) {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return shiftDate(date, -((day - weekStartsOn + weekLength) % weekLength));
}

/** Returns the seven dates of the week containing `date`. */
export function weekDates(date: string, weekStartsOn = 0) {
  const start = weekStart(date, weekStartsOn);
  return Array.from({ length: weekLength }, (_, index) =>
    shiftDate(start, index),
  );
}

/**
 * Lays out a calendar's events for each of `dates`. Every day is placed on its
 * own track, so an event crossing midnight appears in both columns clamped to
 * each day, the way Google Calendar's week view shows it.
 */
export function weekLayout(
  events: CalendarEvent[],
  calendarId: string,
  timeZone: string,
  dates: string[],
): WeekDay[] {
  return dates.map((date) => {
    const visible = eventsOn(events, calendarId, timeZone, date);
    const timed = placeEvents(visible, timeZone, date);
    return {
      date,
      allDay: visible.filter((event) => !!event.start.date),
      timed,
      lanes: Math.max(1, ...timed.map((placed) => placed.lane + 1)),
    };
  });
}

/**
 * Returns a slot's local start time, `YYYY-MM-DDTHH:mm`. `minute` is a minute
 * within the hour, which the grid snaps to {@link slotMinutes}.
 */
export function slotStart(date: string, hour: number, minute: number) {
  const slot = Math.floor(minute / slotMinutes) * slotMinutes;
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date}T${pad(hour)}:${pad(slot)}`;
}
