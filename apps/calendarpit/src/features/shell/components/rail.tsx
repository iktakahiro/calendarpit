import type { Snapshot } from '@calendarpit/server';
import { Select } from '@cloudflare/kumo/components/select';
import { BrandMark, Icon } from '../../../components/icon';
import type { Selection } from '../../workspace/models/selection';
import { sections, type SectionId } from '../models/sections';

/** Connection state of the live data polling. */
export type LiveStatus = 'connecting' | 'live' | 'offline';

/**
 * The sidebar: live status, user and calendar pickers, section navigation
 * with counts, and the storage mode.
 */
export function Rail({
  snapshot,
  selection,
  section,
  status,
  syncedAt,
  historyCount,
  host,
  selectUser,
  selectCalendar,
  openSection,
}: {
  snapshot?: Snapshot;
  selection: Selection;
  section: SectionId;
  status: LiveStatus;
  syncedAt?: Date;
  historyCount: number;
  /** The server address, shown once known in the browser. */
  host: string;
  selectUser: (userId: string) => void;
  /** Selects a calendar; `showSchedule` also switches to the schedule. */
  selectCalendar: (calendarId: string, showSchedule: boolean) => void;
  openSection: (section: SectionId) => void;
}) {
  const { user, calendars, calendar } = selection;
  const activeConnections =
    snapshot?.connections.filter((c) => !c.revoked).length ?? 0;
  const channels = snapshot?.channels.length ?? 0;
  const counts: Partial<Record<SectionId, number>> = {
    history: historyCount,
    ...(activeConnections > 0 ? { connections: activeConnections } : {}),
    ...(channels > 0 ? { watch: channels } : {}),
  };
  return (
    <aside className='rail'>
      <div className='rail-head'>
        <a className='brand' href='/'>
          <BrandMark className='brand-mark' />
          <span>
            calendarpit
            <span className='brand-dot' aria-hidden='true' />
          </span>
        </a>
        <p
          className={`live ${status === 'offline' ? 'offline' : status === 'live' ? 'online' : ''}`}
          title={
            syncedAt
              ? `Last synced ${syncedAt.toLocaleTimeString('en', { hour12: false })}`
              : undefined
          }
        >
          <span className='live-dot' aria-hidden='true' />
          {status === 'offline'
            ? 'Disconnected'
            : status === 'live'
              ? 'Live'
              : 'Connecting…'}
        </p>
      </div>
      <div className='rail-context'>
        <div className='rail-field'>
          <p className='rail-label' id='user-switch-label'>
            Test user
          </p>
          <Select
            aria-labelledby='user-switch-label'
            value={user?.id ?? ''}
            onValueChange={(id: string | null) => id && selectUser(id)}
            items={Object.fromEntries(
              snapshot?.users.map((u) => [u.id, u.name]) ?? [],
            )}
          />
          <p className='rail-email'>
            {user?.email ?? 'Create a test user to begin.'}
          </p>
        </div>
        <div className='rail-field mobile-calendar'>
          <p className='rail-label' id='calendar-switch-label'>
            Calendar
          </p>
          <Select
            aria-labelledby='calendar-switch-label'
            value={calendar?.id ?? ''}
            onValueChange={(id: string | null) =>
              id && selectCalendar(id, false)
            }
            items={Object.fromEntries(calendars.map((c) => [c.id, c.summary]))}
          />
        </div>
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
                  onClick={() => selectCalendar(c.id, true)}
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
            className={section === s.id ? 'active' : ''}
            aria-current={section === s.id ? 'page' : undefined}
            onClick={() => openSection(s.id)}
          >
            <Icon name={s.icon} />
            <span className='nav-label'>{s.label}</span>
            {counts[s.id] !== undefined && (
              <span className='count'>{counts[s.id]}</span>
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
  );
}
