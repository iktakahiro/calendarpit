import type { Calendar } from '../../model/directory';
import type { CalendarEvent } from '../../model/event';
import { interval } from '../events/event-time';
import { expandEvents } from '../events/recurrence';

/**
 * Computes a calendar's busy ranges within `[min, max)`.
 *
 * Series are expanded. Cancelled and transparent events are ignored. Ranges
 * are clipped to the window, and overlapping or touching ranges are merged.
 *
 * @returns Ranges as UTC ISO timestamps, in ascending order.
 */
export function busy(
  events: CalendarEvent[],
  calendar: Calendar,
  min: number,
  max: number,
) {
  const ranges = expandEvents(events, calendar, min, max)
    .filter(
      (e) =>
        e.calendarId === calendar.id &&
        e.status !== 'cancelled' &&
        e.transparency !== 'transparent',
    )
    .map((e) => interval(e, calendar))
    .filter(([a, b]) => a < max && b > min)
    .map(([a, b]) => [Math.max(a, min), Math.min(b, max)] as [number, number])
    .sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const range of ranges) {
    const last = merged.at(-1);
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push(range);
  }
  return merged.map(([start, end]) => ({
    start: new Date(start).toISOString(),
    end: new Date(end).toISOString(),
  }));
}
