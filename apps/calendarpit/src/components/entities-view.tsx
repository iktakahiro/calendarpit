import type { Calendar, Snapshot, User } from '@calendarpit/server';
import { Button } from '@cloudflare/kumo/components/button';
import { EntityEditor } from './entity-editor';
import { Icon } from './icon';

function countLabel(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

export function EntitiesView({
  kind,
  snapshot,
  user,
  calendar,
  pending,
  select,
  save,
  remove,
  openUsers,
}: {
  kind: 'user' | 'calendar';
  snapshot: Snapshot;
  user?: User;
  calendar?: Calendar;
  pending: boolean;
  select: (id: string) => void;
  save: (body: unknown, id?: string) => Promise<void>;
  remove?: () => void;
  openUsers: () => void;
}) {
  const value = kind === 'user' ? user : calendar;
  const rows =
    kind === 'user'
      ? snapshot.users.map((u) => ({
          id: u.id,
          name: u.name,
          detail: u.email,
          note: countLabel(
            snapshot.calendars.filter((c) => c.userId === u.id).length,
            'calendar',
          ),
        }))
      : snapshot.calendars
          .filter((c) => c.userId === user?.id)
          .map((c) => ({
            id: c.id,
            name: c.summary,
            detail: c.timeZone,
            note: c.primary ? 'Primary' : '',
          }));

  if (kind === 'calendar' && !user) {
    return (
      <section className='panel empty-state'>
        <Icon name='persons' />
        <h2>Create a user first</h2>
        <p>Every calendar belongs to a test user.</p>
        <Button onClick={openUsers} icon={<Icon name='plus' />}>
          Add user
        </Button>
      </section>
    );
  }

  return (
    <div className='entity-layout'>
      <section
        className='panel'
        aria-label={kind === 'user' ? 'User directory' : 'Calendar directory'}
      >
        <header className='panel-head'>
          <div>
            <h2>
              {kind === 'user' ? 'Test users' : `${user!.name}'s calendars`}
            </h2>
            <p>
              {kind === 'user'
                ? `${countLabel(rows.length, 'user')} in this workspace`
                : `${countLabel(rows.length, 'calendar')} for this user`}
            </p>
          </div>
          <Icon name={kind === 'user' ? 'persons' : 'calendar'} />
        </header>
        {rows.length ? (
          <ul className='rows entity-list'>
            {rows.map((row) => (
              <li key={row.id}>
                <button
                  type='button'
                  aria-pressed={value?.id === row.id}
                  disabled={pending}
                  onClick={() => select(row.id)}
                >
                  <span className='entity-summary'>
                    <strong>{row.name}</strong>
                    <span>{row.detail}</span>
                    {row.note && <small>{row.note}</small>}
                  </span>
                  <Icon
                    name={value?.id === row.id ? 'check' : 'chevronRight'}
                  />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className='empty-state compact'>
            <h3>No {kind === 'user' ? 'users' : 'calendars'} yet</h3>
            <p>Add the first {kind} using the form.</p>
          </div>
        )}
      </section>
      <EntityEditor
        key={`${kind}:${user?.id}:${value?.id}`}
        kind={kind}
        value={value}
        userId={user?.id}
        pending={pending}
        save={save}
        remove={remove}
      />
    </div>
  );
}
