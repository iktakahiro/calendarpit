import type {
  Snapshot,
  CalendarEvent,
  Calendar,
  User,
} from '@calendarpit/server';
import { Button } from '@cloudflare/kumo/components/button';
import { Input } from '@cloudflare/kumo/components/input';
import { createFileRoute } from '@tanstack/react-router';
import { useCallback, useEffect, useState } from 'react';
import { BrandMark, Icon, type IconName } from '../components/icon';
import { EventEditor, localTime } from '../components/event-editor';
import { DayView, eventEnd, eventStart } from '../components/day-view';
import { HistoryView, type HistoryRow } from '../components/history-view';
import { ConnectionsView } from '../components/connections-view';
import { WatchView } from '../components/watch-view';
import { EntitiesView } from '../components/entities-view';
import { WorkspaceView } from '../components/workspace-view';

export const Route = createFileRoute('/')({ component: Home });
const base = '/__calendarpit';
async function api<T>(
  path: string,
  method = 'GET',
  body?: unknown,
): Promise<T> {
  const response = await fetch(base + path, {
    method,
    headers: method === 'GET' ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error?.message ?? `HTTP ${response.status}`);
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
type Tab =
  | 'schedule'
  | 'users'
  | 'calendars'
  | 'connections'
  | 'watch'
  | 'history'
  | 'workspace';
const sections: {
  id: Tab;
  label: string;
  icon: IconName;
  eyebrow: string;
  lede: string;
}[] = [
  {
    id: 'schedule',
    label: 'Schedule',
    icon: 'calendar',
    eyebrow: 'Schedule',
    lede: '',
  },
  {
    id: 'users',
    label: 'Users',
    icon: 'persons',
    eyebrow: 'Directory',
    lede: 'Create and edit local test identities. No login or password required.',
  },
  {
    id: 'calendars',
    label: 'Calendars',
    icon: 'calendar',
    eyebrow: 'Directory',
    lede: 'Manage calendars for the selected test user.',
  },
  {
    id: 'connections',
    label: 'Connections',
    icon: 'plug',
    eyebrow: 'Integration',
    lede: 'Review permissions and revoke connections to test reconnection.',
  },
  {
    id: 'watch',
    label: 'Watch',
    icon: 'broadcast',
    eyebrow: 'Notifications',
    lede: 'Inspect active subscriptions and webhook deliveries from all calendars.',
  },
  {
    id: 'history',
    label: 'API history',
    icon: 'code',
    eyebrow: 'Protocol log',
    lede: 'Calendar and OAuth requests from your app, with headers and bodies.',
  },
  {
    id: 'workspace',
    label: 'Settings',
    icon: 'gear',
    eyebrow: 'Configuration',
    lede: 'Set your appearance and configure the local test workspace.',
  },
];
function Home() {
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [userId, setUserId] = useState('');
  const [calendarId, setCalendarId] = useState('');
  const [date, setDate] = useState('2026-10-19');
  const [tab, setTab] = useState<Tab>('schedule');
  const [editor, setEditor] = useState<CalendarEvent | 'new'>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [syncedAt, setSyncedAt] = useState<Date>();
  const [offline, setOffline] = useState(false);
  const [host, setHost] = useState('');
  const refresh = useCallback(async () => {
    try {
      const [data, log] = await Promise.all([
        api<Snapshot>('/state'),
        api<HistoryRow[]>('/history'),
      ]);
      setSnapshot(data);
      setHistory(log);
      setSyncedAt(new Date());
      setOffline(false);
    } catch (e) {
      setOffline(true);
      throw e;
    }
  }, []);
  useEffect(() => {
    setHost(window.location.host);
    void refresh().catch((e) => setError(e.message));
    const timer = setInterval(
      () => void refresh().catch((e) => setError(e.message)),
      2000,
    );
    return () => clearInterval(timer);
  }, [refresh]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  const user =
    snapshot?.users.find((u) => u.id === userId) ?? snapshot?.users[0];
  const calendars =
    snapshot?.calendars.filter((c) => c.userId === user?.id) ?? [];
  const calendar =
    calendars.find((c) => c.id === calendarId) ??
    calendars.find((c) => c.primary) ??
    calendars[0];
  async function run(action: () => Promise<unknown>, message: string) {
    setPending(true);
    setError('');
    setNotice('');
    try {
      await action();
      await refresh();
      setNotice(message);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      throw e;
    } finally {
      setPending(false);
    }
  }
  function action(task: () => Promise<unknown>, message: string) {
    void run(task, message).catch(() => {});
  }
  async function saveEvent(body: unknown, id?: string) {
    await run(
      () =>
        api(
          `/calendars/${encodeURIComponent(calendar!.id)}/events${id ? `/${encodeURIComponent(id)}` : ''}`,
          id ? 'PUT' : 'POST',
          body,
        ),
      'Event saved.',
    );
    setEditor(undefined);
  }
  function deleteEvent(e: CalendarEvent) {
    if (!window.confirm('Delete this event?')) return;
    void run(
      () => api(`/calendars/${calendar!.id}/events/${e.id}`, 'DELETE', {}),
      'Event deleted.',
    )
      .then(() =>
        setEditor((current) =>
          current !== 'new' && current?.id === e.id ? undefined : current,
        ),
      )
      .catch(() => {});
  }
  const events =
    snapshot?.events
      .filter((e) => e.calendarId === calendar?.id && e.status !== 'cancelled')
      .filter((e) => {
        const start = eventStart(e, calendar!.timeZone);
        const end = eventEnd(e, calendar!.timeZone);
        return (
          start.slice(0, 10) <= date &&
          (e.end.date ? end > date : end > `${date}T00:00`)
        );
      })
      .sort((a, b) =>
        eventStart(a, calendar!.timeZone).localeCompare(
          eventStart(b, calendar!.timeZone),
        ),
      ) ?? [];
  function shiftDate(days: number) {
    const value = new Date(`${date}T12:00:00Z`);
    value.setUTCDate(value.getUTCDate() + days);
    setDate(value.toISOString().slice(0, 10));
    setEditor(undefined);
  }
  function today() {
    const now = new Date();
    setDate(
      calendar
        ? localTime(now.toISOString(), calendar.timeZone).slice(0, 10)
        : now.toLocaleDateString('en-CA'),
    );
    setEditor(undefined);
  }
  function openTab(next: Tab) {
    setTab(next);
    setEditor(undefined);
  }
  const section = sections.find((s) => s.id === tab)!;
  const activeConnections =
    snapshot?.connections.filter((c) => !c.revoked).length ?? 0;
  return (
    <div className='shell'>
      <a className='skip-link' href='#main'>
        Skip to content
      </a>
      <aside className='rail'>
        <div className='rail-head'>
          <a className='brand' href='/'>
            <BrandMark className='brand-mark' />
            <span>calendarpit</span>
          </a>
          <p
            className={`live ${offline ? 'offline' : syncedAt ? 'online' : ''}`}
            title={
              syncedAt
                ? `Last synced ${syncedAt.toLocaleTimeString('en', { hour12: false })}`
                : undefined
            }
          >
            <span className='live-dot' aria-hidden='true' />
            {offline ? 'Disconnected' : syncedAt ? 'Live' : 'Connecting…'}
          </p>
        </div>
        <div className='rail-context'>
          <div className='rail-field'>
            <label className='rail-label' htmlFor='user-switch'>
              Test user
            </label>
            <select
              id='user-switch'
              value={user?.id ?? ''}
              onChange={(e) => {
                setUserId(e.target.value);
                setCalendarId('');
                setEditor(undefined);
              }}
            >
              {snapshot?.users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            <p className='rail-email'>
              {user?.email ?? 'Create a test user to begin.'}
            </p>
          </div>
          <label className='rail-field mobile-calendar'>
            <span className='rail-label'>Calendar</span>
            <select
              value={calendar?.id ?? ''}
              onChange={(e) => {
                setCalendarId(e.target.value);
                setEditor(undefined);
              }}
            >
              {calendars.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.summary}
                </option>
              ))}
            </select>
          </label>
          <div className='calendar-list'>
            <p className='rail-label' id='calendar-list-label'>
              Calendars
            </p>
            <ul aria-labelledby='calendar-list-label'>
              {calendars.map((c) => (
                <li key={c.id}>
                  <button
                    type='button'
                    className={`calendar-choice ${calendar?.id === c.id ? 'active' : ''}`}
                    aria-current={calendar?.id === c.id ? 'true' : undefined}
                    onClick={() => {
                      setCalendarId(c.id);
                      setEditor(undefined);
                      setTab('schedule');
                    }}
                  >
                    <span className='calendar-swatch' aria-hidden='true' />
                    <span className='calendar-name'>
                      {c.summary}
                      <small>{c.timeZone}</small>
                    </span>
                    {c.primary && (
                      <span className='primary-tag' title='Primary calendar'>
                        Primary
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
            {snapshot && !calendars.length && (
              <p className='rail-empty'>No calendars for this user yet.</p>
            )}
          </div>
        </div>
        <nav className='rail-nav' aria-label='Workspace sections'>
          {sections.map((s) => (
            <button
              key={s.id}
              type='button'
              className={tab === s.id ? 'active' : ''}
              aria-current={tab === s.id ? 'page' : undefined}
              onClick={() => openTab(s.id)}
            >
              <Icon name={s.icon} />
              <span className='nav-label'>{s.label}</span>
              {s.id === 'history' && (
                <span className='count'>{history.length}</span>
              )}
              {s.id === 'connections' && activeConnections > 0 && (
                <span className='count'>{activeConnections}</span>
              )}
              {s.id === 'watch' && (snapshot?.channels.length ?? 0) > 0 && (
                <span className='count'>{snapshot?.channels.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className='rail-foot'>
          <p>
            <span className='memory-tag'>
              {snapshot?.storage.mode === 'sqlite' ? 'SQLite' : 'In-memory'}
            </span>
            {snapshot?.storage.mode === 'sqlite'
              ? 'Changes are saved across restarts.'
              : 'Changes live here until you reset or restart.'}
          </p>
          {host && <code>{host}</code>}
        </div>
      </aside>
      <main id='main' className='main' tabIndex={-1}>
        <header className='view-head'>
          <div>
            <p className='eyebrow'>{section.eyebrow}</p>
            <h1>
              {tab === 'schedule'
                ? (calendar?.summary ?? 'Your schedule')
                : section.label}
            </h1>
            <p className='lede'>
              {tab === 'schedule'
                ? user
                  ? [
                      user.name,
                      calendar?.id,
                      calendar?.primary ? 'primary' : undefined,
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  : 'Create a test user to begin.'
                : section.lede}
            </p>
          </div>
          <div className='view-actions'>
            <Button
              variant='secondary'
              icon={<Icon name='arrowRotateRight' />}
              onClick={() => action(refresh, 'Workspace refreshed.')}
              loading={pending}
            >
              Refresh
            </Button>
          </div>
        </header>
        {!snapshot ? (
          <div className='loading' role='status'>
            <span className='live-dot' aria-hidden='true' />
            Loading your workspace…
          </div>
        ) : (
          <>
            {tab === 'schedule' && (
              <>
                <div className='toolbar'>
                  <div
                    className='date-nav'
                    role='group'
                    aria-label='Date navigation'
                  >
                    <Button
                      shape='square'
                      aria-label='Previous day'
                      icon={<Icon name='chevronLeft' />}
                      onClick={() => shiftDate(-1)}
                    />
                    <Input
                      aria-label='Schedule date'
                      type='date'
                      value={date}
                      required
                      onChange={(e) => {
                        if (e.target.value) {
                          setDate(e.target.value);
                          setEditor(undefined);
                        }
                      }}
                    />
                    <Button
                      shape='square'
                      aria-label='Next day'
                      icon={<Icon name='chevronRight' />}
                      onClick={() => shiftDate(1)}
                    />
                  </div>
                  <Button variant='ghost' onClick={today}>
                    Today
                  </Button>
                  <span className='tz-chip'>
                    {calendar?.timeZone ?? 'No calendar'}
                  </span>
                  <Button
                    className='toolbar-end'
                    variant='primary'
                    icon={<Icon name='plus' />}
                    disabled={!calendar}
                    onClick={() => setEditor('new')}
                  >
                    New event
                  </Button>
                </div>
                <div className={`schedule-layout ${editor ? 'editing' : ''}`}>
                  {calendar ? (
                    <DayView
                      calendar={calendar}
                      date={date}
                      events={events}
                      editingId={
                        editor && editor !== 'new' ? editor.id : undefined
                      }
                      pending={pending}
                      open={setEditor}
                      remove={deleteEvent}
                      create={() => setEditor('new')}
                    />
                  ) : (
                    <section className='day-sheet' aria-label='Daily events'>
                      <div className='empty-state'>
                        <Icon name='calendar' />
                        <h3>No calendar selected</h3>
                        <p>
                          {user
                            ? `${user.name} has no calendars yet. Add one in workspace settings.`
                            : 'Create a test user and a calendar in workspace settings.'}
                        </p>
                        <Button
                          variant='secondary'
                          icon={<Icon name='gear' />}
                          onClick={() => openTab('workspace')}
                        >
                          Open workspace settings
                        </Button>
                      </div>
                    </section>
                  )}
                  {editor && calendar && (
                    <EventEditor
                      key={`${calendar.id}:${editor === 'new' ? 'new' : editor.id}`}
                      calendar={calendar}
                      event={editor === 'new' ? undefined : editor}
                      date={date}
                      save={saveEvent}
                      close={() => setEditor(undefined)}
                      pending={pending}
                    />
                  )}
                </div>
              </>
            )}
            {tab === 'connections' && (
              <ConnectionsView
                snapshot={snapshot}
                pending={pending}
                revoke={(id) =>
                  action(
                    () => api(`/connections/${id}/revoke`, 'POST', {}),
                    'Connection revoked. Reconnect from your app.',
                  )
                }
              />
            )}
            {tab === 'watch' && <WatchView snapshot={snapshot} />}
            {tab === 'history' && (
              <HistoryView
                history={history}
                pending={pending}
                clear={() =>
                  action(
                    () => api('/history', 'DELETE', {}),
                    'History cleared.',
                  )
                }
              />
            )}
            {(tab === 'users' || tab === 'calendars') && (
              <EntitiesView
                kind={tab === 'users' ? 'user' : 'calendar'}
                snapshot={snapshot}
                user={user}
                calendar={calendar}
                pending={pending}
                select={(id) => {
                  if (tab === 'users') {
                    setUserId(id);
                    setCalendarId('');
                  } else setCalendarId(id);
                }}
                save={async (body, id) => {
                  if (tab === 'users') {
                    await run(async () => {
                      const saved = await api<User>(
                        `/users${id ? `/${encodeURIComponent(id)}` : ''}`,
                        id ? 'PATCH' : 'POST',
                        body,
                      );
                      setUserId(saved.id);
                      setCalendarId('');
                    }, 'User saved.');
                  } else {
                    await run(async () => {
                      const saved = await api<Calendar>(
                        `/calendars${id ? `/${encodeURIComponent(id)}` : ''}`,
                        id ? 'PATCH' : 'POST',
                        body,
                      );
                      setCalendarId(saved.id);
                    }, 'Calendar saved.');
                  }
                }}
                remove={
                  tab === 'users'
                    ? user
                      ? () =>
                          action(
                            () =>
                              api(
                                `/users/${encodeURIComponent(user.id)}`,
                                'DELETE',
                                {},
                              ),
                            'User and owned data deleted.',
                          )
                      : undefined
                    : calendar
                      ? () =>
                          action(
                            () =>
                              api(
                                `/calendars/${encodeURIComponent(calendar.id)}`,
                                'DELETE',
                                {},
                              ),
                            'Calendar deleted.',
                          )
                      : undefined
                }
                openUsers={() => openTab('users')}
              />
            )}
            {tab === 'workspace' && (
              <WorkspaceView
                snapshot={snapshot}
                pending={pending}
                loadFixture={(text) =>
                  action(
                    async () => api('/fixtures', 'POST', JSON.parse(text)),
                    'Fixture loaded.',
                  )
                }
                reset={() =>
                  action(
                    () => api('/reset', 'POST', {}),
                    'Startup state restored.',
                  )
                }
              />
            )}
          </>
        )}
      </main>
      <div className='toasts'>
        {error && (
          <div className='toast error' role='alert'>
            <Icon name='circleXmark' />
            <span>{error}</span>
            <Button variant='ghost' size='sm' onClick={() => setError('')}>
              Dismiss
            </Button>
          </div>
        )}
        <p className={`toast ${notice ? '' : 'idle'}`} role='status'>
          {notice && <Icon name='check' />}
          {notice}
        </p>
      </div>
    </div>
  );
}
