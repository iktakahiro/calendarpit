import { Button } from '@cloudflare/kumo/components/button';
import { Empty } from '@cloudflare/kumo/components/empty';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from '../../components/icon';
import { useMessages } from '../../components/language';
import { useNotices } from '../../lib/notices';
import { useHost } from '../../lib/use-host';
import { useHistory } from '../history/hooks/use-history';
import { useChangeStream } from '../workspace/hooks/use-change-stream';
import { useWorkspace } from '../workspace/hooks/use-workspace';
import { useWorkspaceBusy } from '../workspace/hooks/use-workspace-mutation';
import { CommandButton } from '../command/components/command-button';
import type { WorkspaceSearch } from '../workspace/models/workspace-search';
import { Rail, type LiveStatus } from './components/rail';
import { useShellCommands } from './hooks/use-shell-commands';
import { sectionOf, type SectionId } from './models/sections';

/**
 * The admin UI frame around every section: sidebar, section header with the
 * command palette and refresh actions, and loading or error state. It registers
 * the commands available on every screen, so it must render inside `CommandProvider`.
 */
export function WorkspaceShell({
  section,
  search,
  selectUser,
  selectCalendar,
  openSection,
  createEvent,
  children,
}: {
  section: SectionId;
  search: WorkspaceSearch;
  selectUser: (userId: string) => void;
  selectCalendar: (calendarId: string, showSchedule: boolean) => void;
  openSection: (section: SectionId) => void;
  /** Opens the event editor for a new event on the schedule. */
  createEvent: () => void;
  children: ReactNode;
}) {
  const { query, snapshot, selection } = useWorkspace(search);
  const history = useHistory();
  const stream = useChangeStream();
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
  // A refetch without data resets the query to pending, so the failure count
  // keeps the error and retry action visible across retries and polling.
  const loadFailed = !snapshot && query.errorUpdateCount > 0;
  const retryRef = useRef<HTMLButtonElement>(null);
  const retryHadFocus = useRef(false);
  // Loading disables the retry button and drops its focus; return focus once a
  // failed retry re-enables it.
  useEffect(() => {
    if (refresh.isPending || !retryHadFocus.current) return;
    retryHadFocus.current = false;
    if (document.activeElement === document.body) retryRef.current?.focus();
  }, [refresh.isPending]);
  const host = useHost();
  const status: LiveStatus =
    query.isError || loadFailed || stream === 'offline'
      ? 'offline'
      : query.isSuccess && stream === 'open'
        ? 'live'
        : 'connecting';
  useShellCommands({
    snapshot,
    selection,
    section,
    busy,
    openSection,
    selectUser,
    selectCalendar,
    createEvent,
    refresh: () => refresh.mutate(),
  });
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
                  : loadFailed
                    ? undefined
                    : t['shell.createUser']
                : meta.lede && t[meta.lede]}
            </p>
          </div>
          <div className='view-actions'>
            <CommandButton />
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
        ) : loadFailed ? (
          <div role='alert'>
            <Empty
              className='panel empty-state'
              icon={<Icon name='circleXmark' />}
              title={t['shell.loadErrorTitle']}
              description={t['shell.loadErrorDescription']}
              contents={
                <Button
                  ref={retryRef}
                  variant='primary'
                  icon={<Icon name='arrowRotateRight' />}
                  loading={refresh.isPending}
                  onClick={(event) => {
                    retryHadFocus.current =
                      document.activeElement === event.currentTarget;
                    refresh.mutate();
                  }}
                >
                  {t['shell.tryAgain']}
                </Button>
              }
            />
          </div>
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
