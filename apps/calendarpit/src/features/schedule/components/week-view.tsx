import type { Calendar, CalendarEvent } from '@calendarpit/server';
import { useEffect, useRef } from 'react';
import { useLocale, useMessages } from '../../../components/language';
import { shortDate, weekdayLabel } from '../models/dates';
import {
  clockLabel,
  crossesClockChange,
  dayMinutes,
  minuteOf,
} from '../models/day-layout';
import { localTime } from '../models/local-time';
import { slotStart, weekDates, weekLayout } from '../models/week-layout';

/** Hours of the day track, one row each. */
const hours = Array.from({ length: 24 }, (_, hour) => hour);

/** Formats an hour as `09`. */
const pad = (part: number) => String(part).padStart(2, '0');

/**
 * One week of a calendar: a day column per date, with timed events positioned
 * on a 24-hour track and all-day events above it. Clicking an empty slot
 * starts a new event at that time; clicking a day heading opens its day view.
 *
 * The grid draws a fixed 24-hour scale, so a day with a clock change shifts by
 * its offset. The footnote says so, and the day view reports exact times.
 */
export function WeekView({
  calendar,
  date,
  events,
  editingId,
  now,
  open,
  create,
  showDate,
}: {
  calendar: Calendar;
  /** Date inside the shown week, `YYYY-MM-DD`. */
  date: string;
  events: CalendarEvent[];
  editingId?: string;
  /** Current time, for the "now" marker. */
  now: Date;
  open: (event: CalendarEvent) => void;
  /** Starts a new event at a local `YYYY-MM-DDTHH:mm`. */
  create: (at: string) => void;
  showDate: (date: string) => void;
}) {
  const t = useMessages();
  const locale = useLocale();
  const timeZone = calendar.timeZone;
  const body = useRef<HTMLDivElement>(null);
  const dates = weekDates(date);
  const first = dates[0]!;
  const last = dates[6]!;
  const days = weekLayout(events, calendar.id, timeZone, dates);
  const nowLocal = localTime(now.toISOString(), timeZone);
  const nowDate = nowLocal.slice(0, 10);
  const total = days.reduce(
    (sum, day) => sum + day.timed.length + day.allDay.length,
    0,
  );
  const hasAllDay = days.some((day) => day.allDay.length > 0);
  const clockChange = days.some((day) =>
    crossesClockChange(
      day.timed.map((placed) => placed.event),
      timeZone,
    ),
  );
  useEffect(() => {
    // Open on the working hours instead of midnight, and on the current time
    // when the week contains it. Reading the clock here keeps the scroll from
    // jumping every time the "now" marker moves.
    const element = body.current;
    if (!element) return;
    const local = localTime(new Date().toISOString(), timeZone);
    const day = local.slice(0, 10);
    const minute =
      day >= first && day <= last
        ? Math.max(0, minuteOf(local, day) - 90)
        : 7 * 60;
    element.scrollTop = (minute / dayMinutes) * element.scrollHeight;
  }, [first, last, timeZone]);
  return (
    <section className='day-sheet' aria-label={t['week.weeklyEvents']}>
      <header className='day-head'>
        <div>
          <h2>
            {t['week.range'](
              shortDate(first, locale),
              shortDate(last, locale),
              first.slice(0, 4),
            )}
          </h2>
          <p>
            <span>{t['common.events'](total)}</span>
            <span>{t['week.weekOf'](weekdayLabel(first, locale))}</span>
          </p>
        </div>
        <div className='legend' aria-hidden='true'>
          <span>
            <i className='swatch busy' /> {t['common.busy']}
          </span>
          <span>
            <i className='swatch free' /> {t['common.free']}
          </span>
        </div>
      </header>
      <div className='week-head-row'>
        <span className='week-gutter-cell' />
        {days.map((day) => (
          <button
            key={day.date}
            type='button'
            className={`week-day-head ${day.date === date ? 'current' : ''} ${day.date === nowDate ? 'today' : ''}`}
            aria-current={day.date === date ? 'date' : undefined}
            onClick={() => showDate(day.date)}
          >
            <span className='week-weekday'>
              {weekdayLabel(day.date, locale)}
            </span>
            <span className='week-daynum'>{Number(day.date.slice(8))}</span>
          </button>
        ))}
      </div>
      {hasAllDay && (
        <div className='week-allday-row'>
          <span className='week-gutter-cell'>{t['common.allDay']}</span>
          {days.map((day) => (
            <div key={day.date} className='week-allday'>
              {day.allDay.map((event) => (
                <button
                  key={event.id}
                  type='button'
                  className={`track-chip ${event.transparency === 'transparent' ? 'free' : 'busy'} ${editingId === event.id ? 'selected' : ''}`}
                  onClick={() => open(event)}
                >
                  {event.summary || t['common.untitled']}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
      <div className='week-body' ref={body}>
        <div className='week-gutter'>
          {hours.map((hour) => (
            <span
              key={hour}
              className='week-hour'
              style={{ top: `${(hour / 24) * 100}%` }}
            >
              {pad(hour)}
            </span>
          ))}
        </div>
        {days.map((day) => (
          <div
            key={day.date}
            className={`week-col ${day.date === date ? 'current' : ''}`}
          >
            <div className='week-slots'>
              {hours.map((hour) => (
                <button
                  key={hour}
                  type='button'
                  className='week-slot'
                  aria-label={t['week.newEventAt'](
                    `${pad(hour)}:00`,
                    weekdayLabel(day.date, locale),
                    shortDate(day.date, locale),
                  )}
                  onClick={(e) => {
                    // The upper half of an hour starts on the hour, the lower
                    // half on the half hour. Keyboard activation reports no
                    // pointer position and starts on the hour.
                    const box = e.currentTarget.getBoundingClientRect();
                    const half = e.clientY - box.top >= box.height / 2 ? 30 : 0;
                    create(slotStart(day.date, hour, half));
                  }}
                />
              ))}
            </div>
            <div className='week-events'>
              {day.timed.map((placed) => {
                const free = placed.event.transparency === 'transparent';
                const from = clockLabel(placed.start, day.date, locale);
                return (
                  <button
                    key={placed.event.id}
                    type='button'
                    className={`week-event ${free ? 'free' : 'busy'} ${editingId === placed.event.id ? 'selected' : ''}`}
                    aria-current={
                      editingId === placed.event.id ? 'true' : undefined
                    }
                    style={{
                      top: `${(placed.startMinute / dayMinutes) * 100}%`,
                      height: `${((placed.endMinute - placed.startMinute) / dayMinutes) * 100}%`,
                      left: `${(placed.lane / day.lanes) * 100}%`,
                      width: `${100 / day.lanes}%`,
                    }}
                    onClick={() => open(placed.event)}
                  >
                    <strong>
                      {placed.event.summary || t['common.untitled']}
                    </strong>
                    <span>{from.time}</span>
                  </button>
                );
              })}
            </div>
            {day.date === nowDate && (
              <span
                className='week-now'
                style={{
                  top: `${(minuteOf(nowLocal, nowDate) / dayMinutes) * 100}%`,
                }}
              />
            )}
          </div>
        ))}
      </div>
      <footer className='day-footnote'>
        {t['common.zoneBefore']}
        <code>{timeZone}</code>
        {t['week.zoneAfter']}
        {clockChange && t['week.clockChange']}
      </footer>
    </section>
  );
}
