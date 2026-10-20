import type { Snapshot } from '@calendarpit/server';
import { Select } from '@cloudflare/kumo/components/select';
import { BrandLogo } from '../../../components/brand-logo';
import { Icon } from '../../../components/icon';
import { useLocale, useMessages } from '../../../components/language';
import { formatClock } from '../../../lib/format';
import type { Selection } from '../../workspace/models/selection';
import {
  sectionGroups,
  sections,
  type Section,
  type SectionId,
} from '../models/sections';

/** Connection state of the live updates: the change stream and data reads. */
export type LiveStatus = 'connecting' | 'live' | 'offline';

/**
 * The sidebar: live status, user and calendar pickers, grouped section
 * navigation with counts, and the storage mode.
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
  const t = useMessages();
  const locale = useLocale();
  const { user, calendars, calendar } = selection;
  const activeConnections =
    snapshot?.connections.filter((c) => !c.revoked).length ?? 0;
  const channels = snapshot?.channels.length ?? 0;
  const counts: Partial<Record<SectionId, number>> = {
    history: historyCount,
    ...(activeConnections > 0 ? { connections: activeConnections } : {}),
    ...(channels > 0 ? { watch: channels } : {}),
  };
  const navButton = (s: Section) => (
    <button
      key={s.id}
      type='button'
      className={section === s.id ? 'active' : ''}
      aria-current={section === s.id ? 'page' : undefined}
      onClick={() => openSection(s.id)}
    >
      <Icon name={s.icon} />
      <span className='nav-label'>{t[s.label]}</span>
      {counts[s.id] !== undefined && (
        <span className='count'>{counts[s.id]}</span>
      )}
    </button>
  );
  return (
    <aside className='rail'>
      <div className='rail-head'>
        <a className='brand' href='/'>
          <BrandLogo className='brand-logo' />
        </a>
        <p
          className={`live ${status === 'offline' ? 'offline' : status === 'live' ? 'online' : ''}`}
          title={
            syncedAt
              ? t['rail.lastSynced'](formatClock(syncedAt, locale))
              : undefined
          }
        >
          <span className='live-dot' aria-hidden='true' />
          {status === 'offline'
            ? t['rail.disconnected']
            : status === 'live'
              ? t['rail.live']
              : t['rail.connecting']}
        </p>
      </div>
      <div className='rail-context'>
        <div className='rail-field'>
          <p className='rail-label' id='user-switch-label'>
            {t['rail.testUser']}
          </p>
          <Select
            aria-labelledby='user-switch-label'
            value={user?.id ?? ''}
            onValueChange={(id: string | null) => id && selectUser(id)}
            items={Object.fromEntries(
              snapshot?.users.map((u) => [u.id, u.name]) ?? [],
            )}
          />
          <p className='rail-email'>{user?.email ?? t['shell.createUser']}</p>
        </div>
        <div className='rail-field mobile-calendar'>
          <p className='rail-label' id='calendar-switch-label'>
            {t['rail.calendar']}
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
            {t['rail.calendars']}
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
                    <span
                      className='primary-tag'
                      title={t['rail.primaryTitle']}
                    >
                      {t['rail.primary']}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          {snapshot && !calendars.length && (
            <p className='rail-empty'>{t['rail.noCalendars']}</p>
          )}
        </div>
      </div>
      <nav className='rail-nav' aria-label={t['rail.sections']}>
        {sections.filter((s) => !s.group).map(navButton)}
        {sectionGroups.map((g) => (
          <div
            key={g.id}
            className='rail-nav-group'
            role='group'
            aria-labelledby={`nav-group-${g.id}`}
          >
            <p className='rail-label' id={`nav-group-${g.id}`}>
              {t[g.label]}
            </p>
            {sections.filter((s) => s.group === g.id).map(navButton)}
          </div>
        ))}
      </nav>
      <div className='rail-foot'>
        <p>
          <span className='memory-tag'>
            {snapshot?.storage.mode === 'sqlite'
              ? t['rail.sqlite']
              : t['rail.memory']}
          </span>
          {snapshot?.storage.mode === 'sqlite'
            ? t['rail.sqliteNote']
            : t['rail.memoryNote']}
        </p>
        {host && <code>{host}</code>}
      </div>
    </aside>
  );
}
