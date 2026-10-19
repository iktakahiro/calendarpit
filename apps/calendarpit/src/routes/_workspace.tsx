import { createFileRoute, Outlet, useLocation } from '@tanstack/react-router';
import { CommandProvider } from '../features/command/components/command-provider';
import { NoticesProvider } from '../lib/notices';
import type { SectionId } from '../features/shell/models/sections';
import { WorkspaceShell } from '../features/shell/workspace-shell';
import { parseWorkspaceSearch } from '../features/workspace/models/workspace-search';

/** URL path of each section. */
const sectionPaths = {
  schedule: '/',
  users: '/users',
  calendars: '/calendars',
  connections: '/connections',
  watch: '/watch',
  history: '/history',
  settings: '/settings',
} as const satisfies Record<SectionId, string>;

const sectionAt = (pathname: string) =>
  (Object.entries(sectionPaths).find(([, path]) => path === pathname)?.[0] ??
    'schedule') as SectionId;

export const Route = createFileRoute('/_workspace')({
  validateSearch: parseWorkspaceSearch,
  component: WorkspaceLayout,
});

function WorkspaceLayout() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { pathname } = useLocation();
  return (
    <NoticesProvider>
      <CommandProvider>
        <WorkspaceShell
          section={sectionAt(pathname)}
          search={search}
          openSection={(section) =>
            navigate({
              to: sectionPaths[section],
              search: { user: search.user, calendar: search.calendar },
            })
          }
          createEvent={() =>
            navigate({
              to: '/',
              search: (previous) => ({
                ...(pathname === '/'
                  ? previous
                  : { user: search.user, calendar: search.calendar }),
                event: 'new',
                at: undefined,
              }),
            })
          }
          selectUser={(user) => navigate({ to: pathname, search: { user } })}
          selectCalendar={(calendar, showSchedule) =>
            navigate({
              to: showSchedule ? '/' : pathname,
              search: (previous) => ({
                ...(showSchedule ? {} : previous),
                user: search.user,
                calendar,
                event: undefined,
              }),
            })
          }
        >
          <Outlet />
        </WorkspaceShell>
      </CommandProvider>
    </NoticesProvider>
  );
}
