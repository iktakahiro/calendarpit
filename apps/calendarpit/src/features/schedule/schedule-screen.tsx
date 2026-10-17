import type { Snapshot } from '@calendarpit/server';
import { Button } from '@cloudflare/kumo/components/button';
import { Input } from '@cloudflare/kumo/components/input';
import { Icon } from '../../components/icon';
import { useNow } from '../../lib/use-now';
import { useWorkspaceBusy } from '../workspace/hooks/use-workspace-mutation';
import type { Selection } from '../workspace/models/selection';
import { DayView } from './components/day-view';
import { EventEditor } from './components/event-editor';
import { useDeleteEvent } from './hooks/use-event-mutations';
import { shiftDate, today } from './models/dates';
import { eventsOn } from './models/day-layout';

/** The selected calendar's day: the day view plus the event editor. */
export function ScheduleScreen({
  snapshot,
  selection,
  date,
  editing,
  showDate,
  edit,
  openSettings,
}: {
  snapshot: Snapshot;
  selection: Selection;
  date: string;
  /** Event open in the editor: an event ID, `new`, or `undefined`. */
  editing?: string;
  /** Shows another date and closes the editor. */
  showDate: (date: string) => void;
  /** Opens the editor for an event ID or `new`, or closes it. */
  edit: (event?: string) => void;
  openSettings: () => void;
}) {
  const busy = useWorkspaceBusy();
  const now = useNow();
  const remove = useDeleteEvent();
  const { user, calendar } = selection;
  const events = calendar
    ? eventsOn(snapshot.events, calendar.id, calendar.timeZone, date)
    : [];
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
        <div className='date-nav' role='group' aria-label='Date navigation'>
          <Button
            shape='square'
            aria-label='Previous day'
            icon={<Icon name='chevronLeft' />}
            onClick={() => showDate(shiftDate(date, -1))}
          />
          <Input
            aria-label='Schedule date'
            type='date'
            value={date}
            required
            onChange={(e) => {
              if (e.target.value) showDate(e.target.value);
            }}
          />
          <Button
            shape='square'
            aria-label='Next day'
            icon={<Icon name='chevronRight' />}
            onClick={() => showDate(shiftDate(date, 1))}
          />
        </div>
        <Button
          variant='ghost'
          onClick={() => showDate(today(new Date(), calendar?.timeZone))}
        >
          Today
        </Button>
        <span className='tz-chip'>{calendar?.timeZone ?? 'No calendar'}</span>
        <Button
          className='toolbar-end'
          variant='primary'
          icon={<Icon name='plus' />}
          disabled={!calendar}
          onClick={() => edit('new')}
        >
          New event
        </Button>
      </div>
      <div className={`schedule-layout ${editorOpen ? 'editing' : ''}`}>
        {calendar ? (
          <DayView
            calendar={calendar}
            date={date}
            events={events}
            editingId={editedEvent?.id}
            now={now}
            busy={busy}
            open={(event) => edit(event.id)}
            remove={(event) => {
              if (!window.confirm('Delete this event?')) return;
              remove.mutate(
                { calendarId: calendar.id, id: event.id },
                {
                  onSuccess: () => {
                    if (editing === event.id) edit(undefined);
                  },
                },
              );
            }}
            create={() => edit('new')}
          />
        ) : (
          <section className='day-sheet' aria-label='Daily events'>
            <div className='empty-state'>
              <Icon name='calendar' />
              <h3>No calendar selected</h3>
              <p>
                {user
                  ? `${user.name} has no calendars yet. Add one in workspace settings.`
                  : 'Create a test user and a calendar in workspace settings.'}
              </p>
              <Button
                variant='secondary'
                icon={<Icon name='gear' />}
                onClick={openSettings}
              >
                Open workspace settings
              </Button>
            </div>
          </section>
        )}
        {editorOpen && calendar && (
          <EventEditor
            key={`${calendar.id}:${editing}`}
            calendar={calendar}
            event={editedEvent}
            date={date}
            close={() => edit(undefined)}
          />
        )}
      </div>
    </>
  );
}
