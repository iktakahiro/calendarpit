import { Button } from '@cloudflare/kumo/components/button';
import { Icon } from '../../components/icon';
import { useWorkspaceBusy } from '../workspace/hooks/use-workspace-mutation';
import type { Selection } from '../workspace/models/selection';
import { CalendarEditor } from './components/calendar-editor';
import { DirectoryList } from './components/directory-list';
import { countLabel } from './models/directory-forms';

/** Lists the selected user's calendars and edits the selected one. */
export function CalendarsScreen({
  selection,
  selectCalendar,
  openUsers,
}: {
  selection: Selection;
  selectCalendar: (calendarId: string) => void;
  openUsers: () => void;
}) {
  const busy = useWorkspaceBusy();
  const { user, calendars, calendar } = selection;
  if (!user)
    return (
      <section className='panel empty-state'>
        <Icon name='persons' />
        <h2>Create a user first</h2>
        <p>Every calendar belongs to a test user.</p>
        <Button onClick={openUsers} icon={<Icon name='plus' />}>
          Add user
        </Button>
      </section>
    );
  const rows = calendars.map((c) => ({
    id: c.id,
    name: c.summary,
    detail: c.timeZone,
    note: c.primary ? 'Primary' : '',
  }));
  return (
    <div className='entity-layout'>
      <DirectoryList
        label='Calendar directory'
        title={`${user.name}'s calendars`}
        subtitle={`${countLabel(rows.length, 'calendar')} for this user`}
        icon='calendar'
        noun='calendar'
        rows={rows}
        selectedId={calendar?.id}
        disabled={busy}
        select={selectCalendar}
      />
      <CalendarEditor
        key={`${user.id}:${calendar?.id ?? 'none'}`}
        userId={user.id}
        calendar={calendar}
        saved={(saved) => selectCalendar(saved.id)}
      />
    </div>
  );
}
