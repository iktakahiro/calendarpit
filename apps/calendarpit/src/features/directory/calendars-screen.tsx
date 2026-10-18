import { Button } from '@cloudflare/kumo/components/button';
import { Empty } from '@cloudflare/kumo/components/empty';
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
      <Empty
        className='panel empty-state'
        icon={<Icon name='persons' />}
        title='Create a user first'
        description='Every calendar belongs to a test user.'
        contents={
          <Button onClick={openUsers} icon={<Icon name='plus' />}>
            Add user
          </Button>
        }
      />
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
