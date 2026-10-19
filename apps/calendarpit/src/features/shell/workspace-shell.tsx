import { Button } from '@cloudflare/kumo/components/button';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Icon } from '../../components/icon';
import { useMessages } from '../../components/language';
import { useNotices } from '../../lib/notices';
import { useHost } from '../../lib/use-host';
import { useHistory } from '../history/hooks/use-history';
import { useWorkspace } from '../workspace/hooks/use-workspace';
import { useWorkspaceBusy } from '../workspace/hooks/use-workspace-mutation';
import type { WorkspaceSearch } from '../workspace/models/workspace-search';
import { Rail, type LiveStatus } from './components/rail';
import { sectionOf, type SectionId } from './models/sections';

/**
 * The admin UI frame around every section: sidebar, section header with a
 * refresh action, and loading state.
 */
export function WorkspaceShell({
  section,
  search,
  selectUser,
  selectCalendar,
  openSection,
  children,
}: {
  section: SectionId;
  search: WorkspaceSearch;
  selectUser: (userId: string) => void;
  selectCalendar: (calendarId: string, showSchedule: boolean) => void;
  openSection: (section: SectionId) => void;
  children: ReactNode;
}) {
  const { query, snapshot, selection } = useWorkspace(search);
  const history = useHistory();
  const queryClient = useQueryClient();
  const { succeed, fail } = useNotices();
  const t = useMessages();
  const busy = useWorkspaceBusy();
  // A mutation, so a manual refresh also disables conflicting actions.
  const refresh = useMutation({
    mutationFn: () =>
      queryClient.refetchQueries(
        { queryKey: ['workspace'] },
        { throwOnError: true },
      ),
    onSuccess: () => succeed(t['shell.refreshed']),
    onError: fail,
  });
  const host = useHost();
  const status: LiveStatus = query.isError
    ? 'offline'
    : query.isSuccess
      ? 'live'
      : 'connecting';
  const meta = sectionOf(section);
  const { user, calendar } = selection;
  return (
    <div className='shell'>
      <a className='skip-link' href='#main'>
        {t['shell.skip']}
      </a>
      <Rail
        snapshot={snapshot}
        selection={selection}
        section={section}
        status={status}
        syncedAt={
          query.dataUpdatedAt ? new Date(query.dataUpdatedAt) : undefined
        }
        historyCount={history.data?.length ?? 0}
        host={host}
        selectUser={selectUser}
        selectCalendar={selectCalendar}
        openSection={openSection}
      />
      <main id='main' className='main' tabIndex={-1}>
        <header className='view-head'>
          <div>
            <p className='eyebrow'>{t[meta.eyebrow]}</p>
            <h1>
              {section === 'schedule'
                ? (calendar?.summary ?? t['shell.yourSchedule'])
                : t[meta.label]}
            </h1>
            <p className='lede'>
              {section === 'schedule'
                ? user
                  ? [
                      user.name,
                      calendar?.id,
                      calendar?.primary ? t['shell.primary'] : undefined,
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  : t['shell.createUser']
                : meta.lede && t[meta.lede]}
            </p>
          </div>
          <div className='view-actions'>
            <Button
              variant='secondary'
              icon={<Icon name='arrowRotateRight' />}
              loading={busy}
              onClick={() => refresh.mutate()}
            >
              {t['shell.refresh']}
            </Button>
          </div>
        </header>
        {snapshot ? (
          children
        ) : (
          <div className='loading' role='status'>
            <span className='live-dot' aria-hidden='true' />
            {t['shell.loading']}
          </div>
        )}
      </main>
    </div>
  );
}
