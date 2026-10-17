import type { Snapshot } from '@calendarpit/server';
import { useWorkspaceBusy } from '../workspace/hooks/use-workspace-mutation';
import type { Selection } from '../workspace/models/selection';
import { DirectoryList } from './components/directory-list';
import { UserEditor } from './components/user-editor';
import { countLabel } from './models/directory-forms';

/** Lists test users and edits the selected one. */
export function UsersScreen({
  snapshot,
  selection,
  selectUser,
}: {
  snapshot: Snapshot;
  selection: Selection;
  selectUser: (userId: string) => void;
}) {
  const busy = useWorkspaceBusy();
  const rows = snapshot.users.map((u) => ({
    id: u.id,
    name: u.name,
    detail: u.email,
    note: countLabel(
      snapshot.calendars.filter((c) => c.userId === u.id).length,
      'calendar',
    ),
  }));
  return (
    <div className='entity-layout'>
      <DirectoryList
        label='User directory'
        title='Test users'
        subtitle={`${countLabel(rows.length, 'user')} in this workspace`}
        icon='persons'
        noun='user'
        rows={rows}
        selectedId={selection.user?.id}
        disabled={busy}
        select={selectUser}
      />
      <UserEditor
        key={selection.user?.id ?? 'none'}
        user={selection.user}
        saved={(user) => selectUser(user.id)}
      />
    </div>
  );
}
