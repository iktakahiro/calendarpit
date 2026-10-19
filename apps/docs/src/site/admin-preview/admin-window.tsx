import type { ReactNode } from 'react';
import {
  Calendar,
  ChevronsUpDown,
  Code,
  Plug,
  Radio,
  RotateCw,
  Settings,
  Users,
} from 'lucide-react';
import logoDark from '../../assets/logo-dark.svg';
import logoLight from '../../assets/logo-light.svg';
import {
  sampleCalendars,
  sampleChannels,
  sampleConnections,
  sampleRequests,
  sampleUser,
} from './sample-workspace';

/** Admin UI sections, in the order the sidebar lists them. */
export type AdminSection =
  | 'schedule'
  | 'users'
  | 'calendars'
  | 'connections'
  | 'watch'
  | 'history'
  | 'settings';

const sections: {
  id: AdminSection;
  label: string;
  icon: typeof Calendar;
  count?: number;
}[] = [
  { id: 'schedule', label: 'Schedule', icon: Calendar },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'calendars', label: 'Calendars', icon: Calendar },
  {
    id: 'connections',
    label: 'Connections',
    icon: Plug,
    count: sampleConnections.filter((connection) => !connection.revoked).length,
  },
  { id: 'watch', label: 'Watch', icon: Radio, count: sampleChannels.length },
  {
    id: 'history',
    label: 'API history',
    icon: Code,
    count: sampleRequests.length,
  },
  { id: 'settings', label: 'Settings', icon: Settings },
];

/**
 * Browser chrome around a preview, with the page path in the address bar.
 * The whole window is a picture: it is hidden from assistive technology and
 * holds no focusable controls.
 */
export function BrowserFrame({
  path,
  children,
}: {
  /** Path after `127.0.0.1:4173`, such as `/history`. */
  path: string;
  children: ReactNode;
}) {
  return (
    <div className='am-window' aria-hidden='true'>
      <div className='am-chrome'>
        <span className='am-lights'>
          <i />
          <i />
          <i />
        </span>
        <span className='am-address'>
          <span className='am-host'>127.0.0.1:4173</span>
          {path}
        </span>
      </div>
      {children}
    </div>
  );
}

/**
 * The admin UI shell: sidebar with the selected user and calendar, section
 * navigation, storage mode, and the section header.
 */
export function AdminShell({
  section,
  eyebrow,
  title,
  lede,
  children,
}: {
  section: AdminSection;
  eyebrow: string;
  title: string;
  lede: string;
  children: ReactNode;
}) {
  return (
    <div className='am-shell'>
      <div className='am-rail'>
        <div className='am-rail-head'>
          <img className='am-logo' data-theme='light' src={logoLight} alt='' />
          <img className='am-logo' data-theme='dark' src={logoDark} alt='' />
          <span className='am-live'>
            <span className='am-live-dot' />
            Live
          </span>
        </div>
        <div className='am-rail-field'>
          <span className='am-label'>Test user</span>
          <span className='am-select'>
            {sampleUser.name}
            <ChevronsUpDown />
          </span>
          <span className='am-email'>{sampleUser.email}</span>
        </div>
        <div className='am-rail-field'>
          <span className='am-label'>Calendars</span>
          {sampleCalendars.map((calendar, index) => (
            <span
              key={calendar.id}
              className={`am-calendar ${index === 0 ? 'active' : ''}`}
            >
              <span className='am-swatch' />
              <span className='am-calendar-name'>
                {calendar.summary}
                <small>{calendar.timeZone}</small>
              </span>
              {calendar.primary && <span className='am-tag'>Primary</span>}
            </span>
          ))}
        </div>
        <div className='am-nav'>
          {sections.map(({ id, label, icon: Icon, count }) => (
            <span key={id} className={section === id ? 'active' : ''}>
              <Icon />
              <span className='am-nav-label'>{label}</span>
              {count !== undefined && <span className='am-count'>{count}</span>}
            </span>
          ))}
        </div>
        <div className='am-rail-foot'>
          <span>
            <span className='am-tag'>In-memory</span> Changes live here until
            you reset or restart.
          </span>
          <code>127.0.0.1:4173</code>
        </div>
      </div>
      <div className='am-main'>
        <div className='am-head'>
          <div>
            <div className='am-eyebrow'>{eyebrow}</div>
            <div className='am-title'>{title}</div>
            <div className='am-lede'>{lede}</div>
          </div>
          <span className='am-button'>
            <RotateCw />
            Refresh
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}
