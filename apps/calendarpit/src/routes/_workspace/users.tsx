import { createFileRoute } from '@tanstack/react-router';
import { UsersScreen } from '../../features/directory/users-screen';
import { useWorkspace } from '../../features/workspace/hooks/use-workspace';

export const Route = createFileRoute('/_workspace/users')({
  component: Users,
});

function Users() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { snapshot, selection } = useWorkspace(search);
  if (!snapshot) return null;
  return (
    <UsersScreen
      snapshot={snapshot}
      selection={selection}
      selectUser={(user) => navigate({ search: { user } })}
    />
  );
}
