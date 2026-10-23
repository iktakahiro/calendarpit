import type { Snapshot } from '@calendarpit/server';
import { Badge } from '@cloudflare/kumo/components/badge';
import { Button } from '@cloudflare/kumo/components/button';
import { ButtonGroup } from '@cloudflare/kumo/components/button-group';
import { Empty } from '@cloudflare/kumo/components/empty';
import { Icon } from '../../components/icon';
import { useMessages } from '../../components/language';
import { useNow } from '../../lib/use-now';
import { useWorkspaceBusy } from '../workspace/hooks/use-workspace-mutation';
import type { Selection } from '../workspace/models/selection';
import { DateField } from './components/date-field';
import { DayView } from './components/day-view';
import { WeekView } from './components/week-view';
import { EventEditor } from './components/event-editor';
import { useDeleteEvent } from './hooks/use-event-mutations';
import { useScheduleCommands } from './hooks/use-schedule-commands';
import { shiftScheduleDate, today } from './models/dates';
import { eventsOn } from './models/day-layout';

/** The selected calendar's day: the day view plus the event editor. */
export function ScheduleScreen({
  snapshot,
  selection,
  date,
  editing,
  at,
  view,
  showDate,
  edit,
  showView,
  openSettings,
}: {
  snapshot: Snapshot;
  selection: Selection;
  date: string;
  /** Event open in the editor: an event ID, `new`, or `undefined`. */
  editing?: string;
  /** Local start a new event takes from the week grid. */
  at?: string;
  /** Shown layout. The day track is the default. */
  view: 'day' | 'week';
  /** Shows another date and closes the editor. */
  showDate: (date: string) => void;
  /** Opens the editor for an event ID or `new`, or closes it. */
  edit: (event?: string, at?: string) => void;
  /** Switches between the day track and the week grid. */
  showView: (view: 'day' | 'week') => void;
  openSettings: () => void;
}) {
  const busy = useWorkspaceBusy();
  const now = useNow();
  const remove = useDeleteEvent();
  const t = useMessages();
  const { user, calendar } = selection;
  useScheduleCommands({ calendar, date, view, showDate, showView });
  const events = calendar
    ? eventsOn(snapshot.events, calendar.id, calendar.timeZone, date)
    : [];
  const weekEvents = calendar ? snapshot.events : [];
  const editedEvent =
    editing && editing !== 'new'
      ? snapshot.events.find(
          (e) => e.calendarId === calendar?.id && e.id === editing,
        )
      : undefined;
  // An event deleted elsewhere closes its editor instead of turning into "new".
  const editorOpen = editing === 'new' || !!editedEvent;
  return (
    <>
      <div className='toolbar'>
        <div
          className='date-nav'
          role='group'
          aria-label={t['schedule.dateNavigation']}
        >
          <Button
            shape='square'
            aria-label={
              t[
                view === 'week'
                  ? 'schedule.previousWeek'
                  : 'schedule.previousDay'
              ]
            }
            icon={<Icon name='chevronLeft' />}
            onClick={() => showDate(shiftScheduleDate(date, view, -1))}
          />
          <DateField date={date} showDate={showDate} />
          <Button
            shape='square'
            aria-label={
              t[view === 'week' ? 'schedule.nextWeek' : 'schedule.nextDay']
            }
            icon={<Icon name='chevronRight' />}
            onClick={() => showDate(shiftScheduleDate(date, view, 1))}
          />
        </div>
        <Button
          variant='ghost'
          onClick={() => showDate(today(new Date(), calendar?.timeZone))}
        >
          {t['schedule.today']}
        </Button>
        <ButtonGroup aria-label={t['schedule.view']}>
          <Button
            variant={view === 'day' ? 'primary' : 'secondary'}
            aria-pressed={view === 'day'}
            onClick={() => showView('day')}
          >
            {t['schedule.day']}
          </Button>
          <Button
            variant={view === 'week' ? 'primary' : 'secondary'}
            aria-pressed={view === 'week'}
            onClick={() => showView('week')}
          >
            {t['schedule.week']}
          </Button>
        </ButtonGroup>
        <Badge variant='outline' className='tz-chip'>
          {calendar?.timeZone ?? t['schedule.noCalendar']}
        </Badge>
        <Button
          className='toolbar-end'
          variant='primary'
          icon={<Icon name='plus' />}
          disabled={!calendar}
          onClick={() => edit('new')}
        >
          {t['schedule.newEvent']}
        </Button>
      </div>
      <div className={`schedule-layout ${editorOpen ? 'editing' : ''}`}>
        {calendar && view === 'week' ? (
          <WeekView
            calendar={calendar}
            date={date}
            events={weekEvents}
            editingId={editedEvent?.id}
            now={now}
            open={(event) => edit(event.id)}
            create={(at) => edit('new', at)}
            showDate={(day) => showDate(day)}
          />
        ) : calendar ? (
          <DayView
            calendar={calendar}
            date={date}
            events={events}
            editingId={editedEvent?.id}
            now={now}
            busy={busy}
            open={(event) => edit(event.id)}
            remove={(event) =>
              remove.mutate(
                { calendarId: calendar.id, id: event.id },
                {
                  onSuccess: () => {
                    if (editing === event.id) edit(undefined);
                  },
                },
              )
            }
            create={() => edit('new')}
          />
        ) : (
          <section className='day-sheet' aria-label={t['schedule.dailyEvents']}>
            <Empty
              className='empty-state'
              icon={<Icon name='calendar' />}
              title={t['schedule.noCalendarSelected']}
              description={
                user
                  ? t['schedule.userHasNoCalendars'](user.name)
                  : t['schedule.createUserAndCalendar']
              }
              contents={
                <Button
                  variant='secondary'
                  icon={<Icon name='gear' />}
                  onClick={openSettings}
                >
                  {t['schedule.openSettings']}
                </Button>
              }
            />
          </section>
        )}
        {editorOpen && calendar && (
          <EventEditor
            key={`${calendar.id}:${editing}:${at ?? ''}`}
            calendar={calendar}
            event={editedEvent}
            date={date}
            at={editing === 'new' ? at : undefined}
            close={() => edit(undefined)}
          />
        )}
      </div>
    </>
  );
}
