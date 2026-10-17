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
      showDate={(date) =>
        navigate({
          search: (previous) => ({ ...previous, date, event: undefined }),
        })
      }
      edit={(event) =>
        navigate({ search: (previous) => ({ ...previous, event }) })
      }
      openSettings={() =>
        navigate({
          to: '/settings',
          search: { user: search.user, calendar: search.calendar },
        })
      }
    />
  );
}
