import { Button } from '@cloudflare/kumo/components/button';
import { Empty } from '@cloudflare/kumo/components/empty';
import { Icon } from '../../components/icon';
import { useMessages } from '../../components/language';
import { useWorkspaceBusy } from '../workspace/hooks/use-workspace-mutation';
import type { Selection } from '../workspace/models/selection';
import { CalendarEditor } from './components/calendar-editor';
import { DirectoryList } from './components/directory-list';

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
  const t = useMessages();
  const { user, calendars, calendar } = selection;
  if (!user)
    return (
      <Empty
        className='panel empty-state'
        icon={<Icon name='persons' />}
        title={t['directory.createUserFirst']}
        description={t['directory.calendarNeedsUser']}
        contents={
          <Button onClick={openUsers} icon={<Icon name='plus' />}>
            {t['directory.addUser']}
          </Button>
        }
      />
    );
  const rows = calendars.map((c) => ({
    id: c.id,
    name: c.summary,
    detail: c.timeZone,
    note: c.primary ? t['directory.primary'] : '',
  }));
  return (
    <div className='entity-layout'>
      <DirectoryList
        label={t['directory.calendarList']}
        title={t['directory.userCalendars'](user.name)}
        subtitle={t['directory.calendarsForUser'](rows.length)}
        icon='calendar'
        kind='calendar'
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
