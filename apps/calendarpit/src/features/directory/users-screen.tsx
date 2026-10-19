import type { Snapshot } from '@calendarpit/server';
import { useMessages } from '../../components/language';
import { useWorkspaceBusy } from '../workspace/hooks/use-workspace-mutation';
import type { Selection } from '../workspace/models/selection';
import { DirectoryList } from './components/directory-list';
import { UserEditor } from './components/user-editor';

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
  const t = useMessages();
  const rows = snapshot.users.map((u) => ({
    id: u.id,
    name: u.name,
    detail: u.email,
    note: t['directory.calendarCount'](
      snapshot.calendars.filter((c) => c.userId === u.id).length,
    ),
  }));
  return (
    <div className='entity-layout'>
      <DirectoryList
        label={t['directory.userList']}
        title={t['directory.users']}
        subtitle={t['directory.usersInWorkspace'](rows.length)}
        icon='persons'
        kind='user'
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
