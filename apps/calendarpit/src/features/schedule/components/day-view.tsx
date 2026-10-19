import type { Calendar, CalendarEvent } from '@calendarpit/server';
import { Badge } from '@cloudflare/kumo/components/badge';
import { Button } from '@cloudflare/kumo/components/button';
import { Empty } from '@cloudflare/kumo/components/empty';
import { ConfirmButton } from '../../../components/confirm-button';
import { Icon } from '../../../components/icon';
import { useLocale, useMessages } from '../../../components/language';
import { longDate } from '../models/dates';
import {
  clockLabel,
  crossesClockChange,
  dayMinutes,
  duration,
  eventEnd,
  eventStart,
  minuteOf,
  placeEvents,
} from '../models/day-layout';
import { localTime } from '../models/local-time';

/** Hour labels on the day track. */
const ticks = [0, 3, 6, 9, 12, 15, 18, 21, 24];

/**
 * One day of a calendar: a 24-hour overview track, the agenda, and quick
 * actions. The track is hidden when events span a DST change, because a fixed
 * 24-hour scale would misplace them.
 */
export function DayView({
  calendar,
  date,
  events,
  editingId,
  now,
  busy,
  open,
  remove,
  create,
}: {
  calendar: Calendar;
  date: string;
  events: CalendarEvent[];
  editingId?: string;
  /** Current time, for the "now" marker. */
  now: Date;
  busy: boolean;
  open: (event: CalendarEvent) => void;
  remove: (event: CalendarEvent) => void;
  create: () => void;
}) {
  const t = useMessages();
  const locale = useLocale();
  const timeZone = calendar.timeZone;
  const allDay = events.filter((e) => e.start.date);
  const timed = placeEvents(events, timeZone, date);
  const clockChange = crossesClockChange(events, timeZone);
  const laneCount = Math.max(1, ...timed.map((p) => p.lane + 1));
  const nowLocal = localTime(now.toISOString(), timeZone);
  const nowMinute =
    nowLocal.slice(0, 10) === date ? minuteOf(nowLocal, date) : -1;
  const busyCount = events.filter(
    (e) => e.transparency !== 'transparent',
  ).length;
  return (
    <section className='day-sheet' aria-label={t['schedule.dailyEvents']}>
      <header className='day-head'>
        <div>
          <h2>{longDate(date, locale)}</h2>
          <p>
            <span>{t['common.events'](events.length)}</span>
            <span>{t['day.busyCount'](busyCount)}</span>
            <span>{t['day.freeCount'](events.length - busyCount)}</span>
          </p>
        </div>
        <div className='legend' aria-hidden='true'>
          <span>
            <i className='swatch busy' /> {t['common.busy']}
          </span>
          <span>
            <i className='swatch free' /> {t['common.free']}
          </span>
          {nowMinute >= 0 && !clockChange && (
            <span>
              <i className='swatch now' /> {t['day.now']}
            </span>
          )}
        </div>
      </header>
      {clockChange ? (
        <p className='day-footnote'>{t['day.clockChange']}</p>
      ) : (
        <div
          className='day-track'
          role='img'
          aria-label={t['day.overview'](timed.length, allDay.length)}
        >
          {allDay.length > 0 && (
            <div className='track-allday'>
              {allDay.map((e) => (
                <span
                  key={e.id}
                  className={`track-chip ${e.transparency === 'transparent' ? 'free' : 'busy'} ${editingId === e.id ? 'selected' : ''}`}
                >
                  {e.summary || t['common.untitled']}
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
            const from = clockLabel(start, date, locale);
            const to = clockLabel(end, date, locale);
            const free = e.transparency === 'transparent';
            return (
              <li
                key={e.id}
                className={`event-row ${free ? 'free-event' : ''} ${editingId === e.id ? 'selected' : ''}`}
              >
                <div className='event-time'>
                  {e.start.date ? (
                    <>
                      <strong>{t['common.allDay']}</strong>
                      <span>{t['day.until'](e.end.date ?? '')}</span>
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
                  <strong>{e.summary || t['common.untitled']}</strong>
                  <span className='event-meta'>
                    {(e.location || e.description) && (
                      <span>{e.location || e.description}</span>
                    )}
                    <code>{e.id}</code>
                  </span>
                </button>
                <span className='event-tags'>
                  <span className='event-duration'>{duration(e, t)}</span>
                  <Badge variant={free ? 'outline' : 'secondary'}>
                    {free ? t['common.free'] : t['common.busy']}
                  </Badge>
                </span>
                <ConfirmButton
                  iconOnly
                  variant='ghost'
                  size='sm'
                  className='event-delete'
                  ariaLabel={t['day.deleteLabel'](e.summary || e.id)}
                  disabled={busy}
                  icon={<Icon name='trash' />}
                  title={t['day.deleteTitle']}
                  description={t['day.deleteDescription'](
                    e.summary || e.id,
                    calendar.summary,
                  )}
                  confirmLabel={t['day.deleteConfirm']}
                  confirm={() => remove(e)}
                />
              </li>
            );
          })}
        </ol>
      ) : (
        <Empty
          className='empty-state'
          icon={<Icon name='calendar' />}
          title={t['day.emptyTitle']}
          description={t['day.emptyDescription']}
          contents={
            <Button
              variant='secondary'
              icon={<Icon name='plus' />}
              onClick={create}
            >
              {t['schedule.newEvent']}
            </Button>
          }
        />
      )}
      <footer className='day-footnote'>
        {t['common.zoneBefore']}
        <code>{timeZone}</code>
        {t['day.zoneAfter']}
      </footer>
    </section>
  );
}
