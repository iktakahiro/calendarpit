import type { Calendar, CalendarEvent } from '@calendarpit/server';
import { Badge } from '@cloudflare/kumo/components/badge';
import { Button } from '@cloudflare/kumo/components/button';
import { Icon } from './icon';
import { localTime } from './event-editor';

const dayMinutes = 24 * 60;
const ticks = [0, 3, 6, 9, 12, 15, 18, 21, 24];

type Placed = {
  event: CalendarEvent;
  start: string;
  end: string;
  startMinute: number;
  endMinute: number;
  lane: number;
};

/** Returns the calendar-local `YYYY-MM-DDTHH:mm` (timed) or `YYYY-MM-DD` (all-day). */
export function eventStart(event: CalendarEvent, timeZone: string) {
  return event.start.date ?? localTime(event.start.dateTime!, timeZone);
}
export function eventEnd(event: CalendarEvent, timeZone: string) {
  return event.end.date ?? localTime(event.end.dateTime!, timeZone);
}
export function shortDate(date: string) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date.slice(0, 10)}T12:00:00Z`));
}
export function longDate(date: string) {
  return new Intl.DateTimeFormat('en', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));
}
function minuteOf(local: string, date: string) {
  const day = local.slice(0, 10);
  if (day < date) return 0;
  if (day > date) return dayMinutes;
  return Number(local.slice(11, 13)) * 60 + Number(local.slice(14, 16));
}
function duration(event: CalendarEvent) {
  if (event.start.date && event.end.date) {
    const days = Math.round(
      (Date.parse(`${event.end.date}T00:00:00Z`) -
        Date.parse(`${event.start.date}T00:00:00Z`)) /
        86_400_000,
    );
    return days === 1 ? '1 day' : `${days} days`;
  }
  const minutes = Math.round(
    (Date.parse(event.end.dateTime!) - Date.parse(event.start.dateTime!)) /
      60_000,
  );
  if (!Number.isFinite(minutes)) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}
function clock(local: string, date: string) {
  return {
    time: local.slice(11, 16),
    day: local.slice(0, 10) === date ? '' : shortDate(local),
  };
}
function place(events: CalendarEvent[], timeZone: string, date: string) {
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
    .map((item): Placed => {
      let lane = laneEnds.findIndex((end) => end <= item.startMinute);
      if (lane < 0) lane = laneEnds.push(item.endMinute) - 1;
      else laneEnds[lane] = item.endMinute;
      return { ...item, lane };
    });
}

function crossesClockChange(events: CalendarEvent[], timeZone: string) {
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

export function DayView({
  calendar,
  date,
  events,
  editingId,
  pending,
  open,
  remove,
  create,
}: {
  calendar: Calendar;
  date: string;
  events: CalendarEvent[];
  editingId?: string;
  pending: boolean;
  open: (event: CalendarEvent) => void;
  remove: (event: CalendarEvent) => void;
  create: () => void;
}) {
  const timeZone = calendar.timeZone;
  const allDay = events.filter((e) => e.start.date);
  const timed = place(events, timeZone, date);
  const clockChange = crossesClockChange(events, timeZone);
  const laneCount = Math.max(1, ...timed.map((p) => p.lane + 1));
  const now = localTime(new Date().toISOString(), timeZone);
  const nowMinute = now.slice(0, 10) === date ? minuteOf(now, date) : -1;
  const busy = events.filter((e) => e.transparency !== 'transparent').length;
  return (
    <section className='day-sheet' aria-label='Daily events'>
      <header className='day-head'>
        <div>
          <h2>{longDate(date)}</h2>
          <p>
            <span>
              {events.length} {events.length === 1 ? 'event' : 'events'}
            </span>
            <span>{busy} busy</span>
            <span>{events.length - busy} free</span>
          </p>
        </div>
        <div className='legend' aria-hidden='true'>
          <span>
            <i className='swatch busy' /> Busy
          </span>
          <span>
            <i className='swatch free' /> Free
          </span>
          {nowMinute >= 0 && !clockChange && (
            <span>
              <i className='swatch now' /> Now
            </span>
          )}
        </div>
      </header>
      {clockChange ? (
        <p className='day-footnote'>
          These events span a clock change. The 24-hour overview is hidden;
          refer to the event times and elapsed durations below.
        </p>
      ) : (
        <div
          className='day-track'
          role='img'
          aria-label={`Day overview: ${timed.length} timed and ${allDay.length} all-day events.`}
        >
          {allDay.length > 0 && (
            <div className='track-allday'>
              {allDay.map((e) => (
                <span
                  key={e.id}
                  className={`track-chip ${e.transparency === 'transparent' ? 'free' : 'busy'} ${editingId === e.id ? 'selected' : ''}`}
                >
                  {e.summary || '(Untitled event)'}
                </span>
              ))}
            </div>
          )}
          <div
            className='track-lanes'
            style={{ height: `${laneCount * 16 + (laneCount - 1) * 3 + 12}px` }}
          >
            {timed.map((p) => (
              <span
                key={p.event.id}
                className={`track-block ${p.event.transparency === 'transparent' ? 'free' : 'busy'} ${editingId === p.event.id ? 'selected' : ''}`}
                style={{
                  left: `${(p.startMinute / dayMinutes) * 100}%`,
                  width: `${((p.endMinute - p.startMinute) / dayMinutes) * 100}%`,
                  top: `${6 + p.lane * 19}px`,
                }}
              />
            ))}
            {nowMinute >= 0 && (
              <span
                className='track-now'
                style={{ left: `${(nowMinute / dayMinutes) * 100}%` }}
              />
            )}
          </div>
          <div className='track-scale'>
            {ticks.map((t) => (
              <span key={t} style={{ left: `${(t / 24) * 100}%` }}>
                {String(t).padStart(2, '0')}
              </span>
            ))}
          </div>
        </div>
      )}
      {events.length ? (
        <ol className='agenda'>
          {events.map((e) => {
            const start = eventStart(e, timeZone);
            const end = eventEnd(e, timeZone);
            const from = clock(start, date);
            const to = clock(end, date);
            const free = e.transparency === 'transparent';
            return (
              <li
                key={e.id}
                className={`event-row ${free ? 'free-event' : ''} ${editingId === e.id ? 'selected' : ''}`}
              >
                <div className='event-time'>
                  {e.start.date ? (
                    <>
                      <strong>All day</strong>
                      <span>Until {e.end.date}</span>
                    </>
                  ) : (
                    <>
                      <strong>
                        {from.day && <small>{from.day} </small>}
                        {from.time}
                      </strong>
                      <span>
                        {to.day && `${to.day} `}
                        {to.time}
                      </span>
                    </>
                  )}
                </div>
                <i className='event-bar' aria-hidden='true' />
                <button
                  type='button'
                  className='event-content'
                  aria-current={editingId === e.id ? 'true' : undefined}
                  onClick={() => open(e)}
                >
                  <strong>{e.summary || '(Untitled event)'}</strong>
                  <span className='event-meta'>
                    {(e.location || e.description) && (
                      <span>{e.location || e.description}</span>
                    )}
                    <code>{e.id}</code>
                  </span>
                </button>
                <span className='event-tags'>
                  <span className='event-duration'>{duration(e)}</span>
                  <Badge variant={free ? 'outline' : 'secondary'}>
                    {free ? 'Free' : 'Busy'}
                  </Badge>
                </span>
                <Button
                  variant='ghost'
                  shape='square'
                  size='sm'
                  className='event-delete'
                  aria-label={`Delete ${e.summary || e.id}`}
                  disabled={pending}
                  icon={<Icon name='trash' />}
                  onClick={() => remove(e)}
                />
              </li>
            );
          })}
        </ol>
      ) : (
        <div className='empty-state'>
          <Icon name='calendar' />
          <h3>Nothing scheduled</h3>
          <p>
            No events on this date. Add one here, or create it from your app
            through the Calendar API.
          </p>
          <Button
            variant='secondary'
            icon={<Icon name='plus' />}
            onClick={create}
          >
            New event
          </Button>
        </div>
      )}
      <footer className='day-footnote'>
        Times shown in <code>{timeZone}</code>. End times are exclusive. Free
        events do not block availability.
      </footer>
    </section>
  );
}
