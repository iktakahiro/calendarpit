import type { CalendarEvent } from '@calendarpit/server';
import type { Locale } from '../../../lib/locale';
import type { Messages } from '../../../lib/messages';
import { shortDate } from './dates';
import { localTime } from './local-time';

/** Minutes in a day, the width of the day track. */
export const dayMinutes = 24 * 60;

/** A timed event positioned on the day track. */
export type PlacedEvent = {
  event: CalendarEvent;
  start: string;
  end: string;
  /** Start within the shown day, clamped to `[0, dayMinutes]`. */
  startMinute: number;
  /** End within the shown day, clamped to `[0, dayMinutes]`. */
  endMinute: number;
  /** Row on the track; overlapping events get separate lanes. */
  lane: number;
};

/** Returns the calendar-local `YYYY-MM-DDTHH:mm` (timed) or `YYYY-MM-DD` (all-day). */
export function eventStart(event: CalendarEvent, timeZone: string) {
  return event.start.date ?? localTime(event.start.dateTime!, timeZone);
}

/** Like {@link eventStart}, for the exclusive end. */
export function eventEnd(event: CalendarEvent, timeZone: string) {
  return event.end.date ?? localTime(event.end.dateTime!, timeZone);
}

/** Minute of a local time within `date`, clamped to the day. */
export function minuteOf(local: string, date: string) {
  const day = local.slice(0, 10);
  if (day < date) return 0;
  if (day > date) return dayMinutes;
  return Number(local.slice(11, 13)) * 60 + Number(local.slice(14, 16));
}

/**
 * Returns the calendar's visible events on `date`, sorted by start: not
 * cancelled, and overlapping the local day.
 */
export function eventsOn(
  events: CalendarEvent[],
  calendarId: string,
  timeZone: string,
  date: string,
) {
  return events
    .filter((e) => e.calendarId === calendarId && e.status !== 'cancelled')
    .filter((e) => {
      const start = eventStart(e, timeZone);
      const end = eventEnd(e, timeZone);
      return (
        start.slice(0, 10) <= date &&
        (e.end.date ? end > date : end > `${date}T00:00`)
      );
    })
    .sort((a, b) =>
      eventStart(a, timeZone).localeCompare(eventStart(b, timeZone)),
    );
}

/**
 * Formats an event's elapsed duration in the language of `t`, such as
 * `1h 30m` or `2 days` in English.
 */
export function duration(event: CalendarEvent, t: Messages) {
  if (event.start.date && event.end.date) {
    const days = Math.round(
      (Date.parse(`${event.end.date}T00:00:00Z`) -
        Date.parse(`${event.start.date}T00:00:00Z`)) /
        86_400_000,
    );
    return t['day.durationDays'](days);
  }
  const minutes = Math.round(
    (Date.parse(event.end.dateTime!) - Date.parse(event.start.dateTime!)) /
      60_000,
  );
  if (!Number.isFinite(minutes)) return '';
  return t['day.durationTime'](Math.floor(minutes / 60), minutes % 60);
}

/** Splits a local time into `HH:mm` and a day label when not on `date`. */
export function clockLabel(local: string, date: string, locale: Locale) {
  return {
    time: local.slice(11, 16),
    day: local.slice(0, 10) === date ? '' : shortDate(local, locale),
  };
}

/**
 * Positions timed events on the day track. Events are sorted by start (longer
 * first on ties) and each takes the first lane that is free by its start.
 */
export function placeEvents(
  events: CalendarEvent[],
  timeZone: string,
  date: string,
): PlacedEvent[] {
  const laneEnds: number[] = [];
  return events
    .filter((e) => !e.start.date)
    .map((event) => {
      const start = eventStart(event, timeZone);
      const end = eventEnd(event, timeZone);
      return {
        event,
        start,
        end,
        startMinute: minuteOf(start, date),
        endMinute: minuteOf(end, date),
      };
    })
    .sort((a, b) => a.startMinute - b.startMinute || b.endMinute - a.endMinute)
    .map((item): PlacedEvent => {
      let lane = laneEnds.findIndex((end) => end <= item.startMinute);
      if (lane < 0) lane = laneEnds.push(item.endMinute) - 1;
      else laneEnds[lane] = item.endMinute;
      return { ...item, lane };
    });
}

/**
 * Whether the events' times use more than one UTC offset in `timeZone`. A
 * 24-hour track would misplace them across a DST change, so the view hides it.
 */
export function crossesClockChange(events: CalendarEvent[], timeZone: string) {
  const offsets = new Set<number>();
  for (const event of events) {
    for (const time of [event.start.dateTime, event.end.dateTime]) {
      if (!time) continue;
      offsets.add(
        Date.parse(`${localTime(time, timeZone)}:00Z`) -
          Math.floor(Date.parse(time) / 60_000) * 60_000,
      );
    }
  }
  return offsets.size > 1;
}
