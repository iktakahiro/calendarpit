import { createFileRoute } from '@tanstack/react-router';
import { CalendarsScreen } from '../../features/directory/calendars-screen';
import { useWorkspace } from '../../features/workspace/hooks/use-workspace';

export const Route = createFileRoute('/_workspace/calendars')({
  component: Calendars,
});

function Calendars() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { snapshot, selection } = useWorkspace(search);
  if (!snapshot) return null;
  return (
    <CalendarsScreen
      selection={selection}
      selectCalendar={(calendar) =>
        navigate({ search: { user: search.user, calendar } })
      }
      openUsers={() => navigate({ to: '/users', search: {} })}
    />
  );
}
