import type { ReactNode } from 'react';
import {
  Calendar,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Pencil,
  Plus,
  Radio,
  Search,
  ShieldCheck,
  Signal,
  Trash2,
  Users,
} from 'lucide-react';
import type { AdminSection } from './admin-window';
import {
  sampleCalendars,
  sampleChannels,
  sampleClients,
  sampleConnections,
  sampleDeliveries,
  sampleEvents,
  sampleFailure,
  sampleNow,
  sampleRequests,
  sampleToday,
  sampleUser,
  sampleUsers,
  sampleWeek,
} from './sample-workspace';

/** Screens that MDX pages can show with `<AdminScreen view='…' />`. */
export type AdminView =
  | 'schedule-week'
  | 'schedule-day'
  | 'users'
  | 'calendars'
  | 'connections'
  | 'watch'
  | 'history'
  | 'oauth-clients'
  | 'consent';

/** Address, header text, and body of one preview screen. */
type ViewDefinition = {
  path: string;
  /** Omitted for pages outside the admin shell, such as OAuth consent. */
  shell?: {
    section: AdminSection;
    eyebrow: string;
    title: string;
    lede: string;
  };
  body: () => ReactNode;
};

const scheduleShell = {
  section: 'schedule',
  eyebrow: 'Schedule',
  title: 'Work calendar',
  lede: 'Alex Morgan · alex-work · primary',
} as const;

/** Every preview screen, keyed by view name. */
export const adminViews: Record<AdminView, ViewDefinition> = {
  'schedule-week': {
    path: '/?view=week',
    shell: scheduleShell,
    body: () => <WeekSchedule />,
  },
  'schedule-day': {
    path: '/?date=2026-10-19',
    shell: scheduleShell,
    body: () => <DaySchedule />,
  },
  users: {
    path: '/users',
    shell: {
      section: 'users',
      eyebrow: 'Directory',
      title: 'Users',
      lede: 'Create and edit local test identities. No login or password required.',
    },
    body: () => <UserDirectory />,
  },
  calendars: {
    path: '/calendars',
    shell: {
      section: 'calendars',
      eyebrow: 'Directory',
      title: 'Calendars',
      lede: 'Manage calendars for the selected test user.',
    },
    body: () => <CalendarDirectory />,
  },
  connections: {
    path: '/connections',
    shell: {
      section: 'connections',
      eyebrow: 'Integration',
      title: 'Connections',
      lede: 'Review permissions and revoke connections to test reconnection.',
    },
    body: () => <ConnectionList />,
  },
  watch: {
    path: '/watch',
    shell: {
      section: 'watch',
      eyebrow: 'Notifications',
      title: 'Watch',
      lede: 'Inspect active subscriptions and webhook deliveries from all calendars.',
    },
    body: () => <WatchLog />,
  },
  history: {
    path: '/history',
    shell: {
      section: 'history',
      eyebrow: 'Protocol log',
      title: 'API history',
      lede: 'Calendar and OAuth requests from your app, with headers and bodies.',
    },
    body: () => <RequestHistory />,
  },
  'oauth-clients': {
    path: '/settings',
    shell: {
      section: 'settings',
      eyebrow: 'Configuration',
      title: 'Settings',
      lede: 'Set your appearance and configure the local test workspace.',
    },
    body: () => <ClientSettings />,
  },
  consent: {
    path: '/oauth/authorize?client_id=sample-app&scope=…',
    body: () => <ConsentPage />,
  },
};

function Toolbar({ view }: { view: 'day' | 'week' }) {
  return (
    <div className='am-toolbar'>
      <span className='am-button am-icon-button'>
        <ChevronLeft />
      </span>
      <span className='am-button am-date'>
        <CalendarDays />
        2026-10-19
      </span>
      <span className='am-button am-icon-button'>
        <ChevronRight />
      </span>
      <span className='am-button am-ghost'>Today</span>
      <span className='am-segmented'>
        <span className={view === 'day' ? 'on' : ''}>Day</span>
        <span className={view === 'week' ? 'on' : ''}>Week</span>
      </span>
      <span className='am-chip'>Asia/Tokyo</span>
      <span className='am-button am-primary am-end'>
        <Plus />
        New event
      </span>
    </div>
  );
}

function Legend() {
  return (
    <span className='am-legend'>
      <span>
        <i className='am-key busy' />
        Busy
      </span>
      <span>
        <i className='am-key free' />
        Free
      </span>
      <span>
        <i className='am-key now' />
        Now
      </span>
    </span>
  );
}

const weekHours = [9, 10, 11, 12, 13, 14, 15, 16, 17];
const firstHour = weekHours[0] ?? 0;
const hourCount = weekHours.length;

function WeekSchedule() {
  return (
    <>
      <Toolbar view='week' />
      <div className='am-panel'>
        <div className='am-sheet-head'>
          <div>
            <strong>Oct 18 – Oct 24, 2026</strong>
            <small>{sampleEvents.length} events · Week of Sun</small>
          </div>
          <Legend />
        </div>
        <div className='am-week'>
          <div className='am-week-row am-week-days'>
            <span />
            {sampleWeek.map((day, index) => (
              <span
                key={day.date}
                className={index === sampleToday ? 'today' : ''}
              >
                <small>{day.weekday}</small>
                {day.date}
              </span>
            ))}
          </div>
          <div
            className='am-week-row am-week-body'
            style={{ '--am-hours': hourCount }}
          >
            <div className='am-week-gutter'>
              {weekHours.map((hour) => (
                <span key={hour}>{String(hour).padStart(2, '0')}</span>
              ))}
            </div>
            {sampleWeek.map((day, index) => (
              <div
                key={day.date}
                className={`am-week-col ${index === sampleToday ? 'today' : ''}`}
              >
                {sampleEvents
                  .filter((event) => event.day === index)
                  .map((event) => (
                    <span
                      key={event.summary}
                      className={`am-week-event ${event.free ? 'free' : 'busy'}`}
                      style={{
                        top: `${((event.start - firstHour) / hourCount) * 100}%`,
                        height: `${((event.end - event.start) / hourCount) * 100}%`,
                      }}
                    >
                      <strong>{event.summary}</strong>
                      {event.end - event.start >= 1 && (
                        <span>{clock(event.start)}</span>
                      )}
                    </span>
                  ))}
                {index === sampleToday && (
                  <span
                    className='am-week-now'
                    style={{
                      top: `${((sampleNow - firstHour) / hourCount) * 100}%`,
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
        <div className='am-footnote'>
          Times shown in Asia/Tokyo. Click a slot to add an event.
        </div>
      </div>
    </>
  );
}

function DaySchedule() {
  const events = sampleEvents.filter((event) => event.day === sampleToday);
  return (
    <>
      <Toolbar view='day' />
      <div className='am-panel'>
        <div className='am-sheet-head'>
          <div>
            <strong>Monday, October 19, 2026</strong>
            <small>{events.length} events · 1 busy · 1 free</small>
          </div>
          <Legend />
        </div>
        <div className='am-track'>
          <div className='am-track-lane'>
            {events.map((event) => (
              <span
                key={event.summary}
                className={`am-track-block ${event.free ? 'free' : 'busy'}`}
                style={{
                  left: `${(event.start / 24) * 100}%`,
                  width: `${((event.end - event.start) / 24) * 100}%`,
                }}
              />
            ))}
            <span
              className='am-track-now'
              style={{ left: `${(sampleNow / 24) * 100}%` }}
            />
          </div>
          <div className='am-track-scale'>
            {['00', '03', '06', '09', '12', '15', '18', '21', '24'].map(
              (hour) => (
                <span key={hour}>{hour}</span>
              ),
            )}
          </div>
        </div>
        {events.map((event) => (
          <div
            key={event.summary}
            className={`am-agenda ${event.free ? 'free' : ''}`}
          >
            <span className='am-agenda-time'>
              <strong>{clock(event.start)}</strong>
              <small>{clock(event.end)}</small>
            </span>
            <span className='am-agenda-bar' />
            <span className='am-agenda-body'>
              <strong>{event.summary}</strong>
              <small>{event.free ? 'focus-time' : 'planning'}</small>
            </span>
            <span className='am-agenda-meta'>
              {event.end - event.start}h
              <span className='am-badge neutral'>
                {event.free ? 'Free' : 'Busy'}
              </span>
              <Trash2 />
            </span>
          </div>
        ))}
        <div className='am-footnote'>
          Times shown in Asia/Tokyo. End times are exclusive. Free events do not
          block availability.
        </div>
      </div>
    </>
  );
}

/** One entry in a directory list: a title and up to two detail lines. */
type DirectoryEntry = { id: string; title: string; lines: string[] };

/** List-and-editor layout shared by the users and calendars screens. */
function Directory({
  listTitle,
  listSub,
  listIcon,
  entries,
  kind,
  fields,
  check,
}: {
  listTitle: string;
  listSub: string;
  listIcon: ReactNode;
  entries: DirectoryEntry[];
  /** Entity name in the editor, such as `user`. */
  kind: string;
  fields: { label: string; value: string }[];
  /** Optional checkbox under the fields, such as the primary calendar. */
  check?: string;
}) {
  const selected = entries[0];
  return (
    <div className='am-split'>
      <div className='am-panel'>
        <PanelHead title={listTitle} sub={listSub}>
          {listIcon}
        </PanelHead>
        {entries.map((entry, index) => (
          <div
            key={entry.id}
            className={`am-entity ${index === 0 ? 'active' : ''}`}
          >
            <span>
              <strong>{entry.title}</strong>
              {entry.lines.map((line) => (
                <small key={line}>{line}</small>
              ))}
            </span>
            {index === 0 ? <Check /> : <ChevronRight />}
          </div>
        ))}
      </div>
      <div className='am-panel'>
        <div className='am-panel-head'>
          <div>
            <div className='am-eyebrow'>
              {kind === 'user' ? 'Test user' : 'Calendar'}
            </div>
            <strong>Edit {kind}</strong>
            <small>{selected?.id}</small>
          </div>
          <span className='am-button am-ghost'>
            <Plus />
            New {kind}
          </span>
        </div>
        <div className='am-form'>
          {fields.map((field) => (
            <span key={field.label} className='am-field'>
              {field.label}
              <span className='am-input'>{field.value}</span>
            </span>
          ))}
          {check && (
            <span className='am-check'>
              <span className='am-checkbox'>
                <Check />
              </span>
              {check}
            </span>
          )}
          <span className='am-actions'>
            <span className='am-button'>Save {kind}</span>
            <span className='am-button am-danger'>
              <Trash2 />
              Delete
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

function UserDirectory() {
  return (
    <Directory
      listTitle='Test users'
      listSub={`${sampleUsers.length} users in this workspace`}
      listIcon={<Users />}
      entries={sampleUsers.map((user) => ({
        id: user.id,
        title: user.name,
        lines: [
          user.email,
          `${user.calendars} ${user.calendars === 1 ? 'calendar' : 'calendars'}`,
        ],
      }))}
      kind='user'
      fields={[
        { label: 'Name', value: sampleUser.name },
        { label: 'Email', value: sampleUser.email },
      ]}
    />
  );
}

function CalendarDirectory() {
  const [primary] = sampleCalendars;
  return (
    <Directory
      listTitle={`${sampleUser.name}'s calendars`}
      listSub={`${sampleCalendars.length} calendars for this user`}
      listIcon={<Calendar />}
      entries={sampleCalendars.map((calendar) => ({
        id: calendar.id,
        title: calendar.summary,
        lines: calendar.primary
          ? [calendar.timeZone, 'Primary']
          : [calendar.timeZone],
      }))}
      kind='calendar'
      fields={[
        { label: 'Calendar name', value: primary?.summary ?? '' },
        { label: 'Time zone', value: primary?.timeZone ?? '' },
      ]}
      check='Primary calendar'
    />
  );
}

function PanelHead({
  title,
  sub,
  children,
}: {
  title: string;
  sub: string;
  children?: ReactNode;
}) {
  return (
    <div className='am-panel-head'>
      <div>
        <strong>{title}</strong>
        <small>{sub}</small>
      </div>
      {children}
    </div>
  );
}

function ConnectionList() {
  return (
    <div className='am-panel'>
      <PanelHead title='OAuth connections' sub='1 active · 1 revoked'>
        <ShieldCheck />
      </PanelHead>
      {sampleConnections.map((connection) => (
        <div key={connection.user} className='am-row'>
          <span className='am-row-main'>
            <strong>
              {connection.user} <i>→</i> {connection.client}
            </strong>
            <span className='am-scopes'>
              {connection.scopes.map((scope) => (
                <code key={scope}>{scope}</code>
              ))}
            </span>
            <small>Granted {connection.granted}</small>
          </span>
          {connection.revoked ? (
            <span className='am-badge neutral'>Revoked</span>
          ) : (
            <>
              <span className='am-badge go'>Active</span>
              <span className='am-button am-small am-danger'>Revoke</span>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function WatchLog() {
  return (
    <div className='am-stack'>
      <div className='am-panel'>
        <PanelHead title='Watch channels' sub='1 active subscriptions'>
          <Radio />
        </PanelHead>
        {sampleChannels.map((channel) => (
          <div key={channel.id} className='am-row'>
            <span className='am-row-main'>
              <strong>
                <code>{channel.id}</code>
              </strong>
              <small className='am-route'>
                <code>{channel.calendarId}</code> <i>→</i>{' '}
                <code>{channel.address}</code>
              </small>
              <small>Expires {channel.expires}</small>
            </span>
            <span className='am-badge info'>Watching</span>
          </div>
        ))}
      </div>
      <div className='am-panel'>
        <PanelHead
          title='Delivery log'
          sub='Push notifications sent to watch channels, newest first.'
        >
          <Signal />
        </PanelHead>
        <div className='am-table'>
          <span className='am-th'>Channel / message</span>
          <span className='am-th'>State</span>
          <span className='am-th'>Attempts</span>
          <span className='am-th am-wide'>Time</span>
          <span className='am-th'>Status</span>
          {sampleDeliveries.map((delivery) => (
            <span key={delivery.message} className='am-tr'>
              <code>
                {delivery.channel} / #{delivery.message}
              </code>
              <code>{delivery.state}</code>
              <span className='am-num'>
                {delivery.attempts}{' '}
                {delivery.attempts === 1 ? 'attempt' : 'attempts'}
              </span>
              <span className='am-num am-wide'>{delivery.time}</span>
              <span>
                <span
                  className={`am-badge ${delivery.status === 'failed' ? 'stop' : 'go'}`}
                >
                  {delivery.status} · {delivery.httpStatus}
                </span>
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function RequestHistory() {
  const errors = sampleRequests.filter((request) => request.status >= 400);
  return (
    <>
      <div className='am-toolbar'>
        <span className='am-search'>
          <Search />
          Filter by method, path, or status
        </span>
        <span className='am-segmented'>
          <span className='on'>
            All <small>{sampleRequests.length}</small>
          </span>
          <span>
            Errors <small>{errors.length}</small>
          </span>
        </span>
        <span className='am-button am-end'>
          <Trash2 />
          Clear history
        </span>
      </div>
      <div className='am-note'>
        The latest 200 protocol requests, newest first. Credentials are masked.
      </div>
      <div className='am-panel'>
        {sampleRequests.map((request) => {
          const open = request.status === 404;
          return (
            <div
              key={`${request.time}${request.path}`}
              className={`am-request ${open ? 'open' : ''}`}
            >
              <span className={`am-status s${String(request.status)[0]}`}>
                {request.status}
              </span>
              <span className={`am-method ${request.method.toLowerCase()}`}>
                {request.method}
              </span>
              <span className='am-path'>{request.path}</span>
              <span className='am-area'>{request.area}</span>
              <span className='am-time'>{request.time}</span>
              <ChevronRight className='am-chevron' />
              {open && (
                <span className='am-payloads'>
                  <Payload title='Request' value={sampleFailure.request} />
                  <Payload title='Response' value={sampleFailure.response} />
                </span>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function Payload({ title, value }: { title: string; value: unknown }) {
  return (
    <span className='am-payload'>
      <span className='am-payload-head'>
        {title}
        <span>
          <Copy />
          Copy
        </span>
      </span>
      <pre>{JSON.stringify(value, null, 2)}</pre>
    </span>
  );
}

function ClientSettings() {
  return (
    <>
      <div className='am-tabs'>
        <span>Appearance</span>
        <span>Test data</span>
        <span className='on'>OAuth clients</span>
      </div>
      <div className='am-panel'>
        <div className='am-panel-head'>
          <div>
            <strong>Registered OAuth clients</strong>
            <small>
              Edit secrets and redirect URIs. Users, events, and connections
              stay as they are.
            </small>
          </div>
          <span className='am-button am-ghost'>
            <Plus />
            New client
          </span>
        </div>
        {sampleClients.map((client) => (
          <div key={client.id} className='am-row'>
            <span className='am-row-main'>
              <strong>
                <code>{client.id}</code>
              </strong>
              <span className='am-scopes'>
                {client.redirectUris.map((uri) => (
                  <code key={uri}>{uri}</code>
                ))}
              </span>
            </span>
            <span className='am-button am-icon-button am-small'>
              <Pencil />
            </span>
            <span className='am-button am-icon-button am-small am-danger'>
              <Trash2 />
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

function ConsentPage() {
  return (
    <div className='am-consent'>
      <div className='am-consent-inner'>
        <div className='am-consent-eyebrow'>
          Calendarpit / Local authorization
        </div>
        <div className='am-consent-title'>Connect your calendar.</div>
        <p>
          <strong>sample-app</strong> wants access to a test account.
        </p>
        <div className='am-consent-card'>
          <span className='am-field'>
            Test user
            <span className='am-input am-native'>
              Alex Morgan · alex@example.test
              <ChevronRight />
            </span>
          </span>
          <span className='am-field'>
            Requested permissions
            <code>https://www.googleapis.com/auth/calendar</code>
          </span>
          <span className='am-actions'>
            <span className='am-consent-approve'>Approve</span>
            <span className='am-consent-deny'>Deny</span>
          </span>
          <p>This is a local test service. No real Google account is used.</p>
        </div>
      </div>
    </div>
  );
}

/** Formats fractional hours as `HH:MM`. */
function clock(hours: number): string {
  const whole = Math.floor(hours);
  const minutes = Math.round((hours - whole) * 60);
  return `${String(whole).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}
