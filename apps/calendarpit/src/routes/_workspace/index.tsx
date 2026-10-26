import { createFileRoute } from '@tanstack/react-router';
import { ScheduleScreen } from '../../features/schedule/schedule-screen';
import {
  defaultDate,
  parseScheduleSearch,
} from '../../features/schedule/models/schedule-search';
import { useWorkspace } from '../../features/workspace/hooks/use-workspace';

export const Route = createFileRoute('/_workspace/')({
  validateSearch: parseScheduleSearch,
  component: Schedule,
});

function Schedule() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { snapshot, selection } = useWorkspace(search);
  if (!snapshot) return null;
  return (
    <ScheduleScreen
      snapshot={snapshot}
      selection={selection}
      date={search.date ?? defaultDate}
      editing={search.event}
      at={search.at}
      view={search.view ?? 'day'}
      showDate={(date) =>
        navigate({
          search: (previous) => ({
            ...previous,
            date,
            event: undefined,
            at: undefined,
          }),
        })
      }
      edit={(event, at) =>
        navigate({ search: (previous) => ({ ...previous, event, at }) })
      }
      showView={(view) =>
        navigate({
          search: (previous) => ({
            ...previous,
            view: view === 'week' ? 'week' : undefined,
          }),
        })
      }
      openUsers={() => navigate({ to: '/users', search: {} })}
      openCalendars={() =>
        navigate({ to: '/calendars', search: { user: search.user } })
      }
    />
  );
}
