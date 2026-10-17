import type { Calendar, User } from '@calendarpit/server';
import { Button } from '@cloudflare/kumo/components/button';
import { Input } from '@cloudflare/kumo/components/input';
import { useState } from 'react';
import { Icon } from './icon';

export function EntityEditor({
  kind,
  value,
  userId,
  pending,
  save,
  remove,
}: {
  kind: 'user' | 'calendar';
  value?: User | Calendar;
  userId?: string;
  pending: boolean;
  save: (body: unknown, id?: string) => Promise<void>;
  remove?: () => void;
}) {
  const [create, setCreate] = useState(false);
  const [error, setError] = useState('');
  const creating = create || !value;
  return (
    <section
      className='panel'
      aria-label={`${creating ? 'New' : 'Edit'} ${kind}`}
    >
      <header className='panel-head'>
        <div>
          <p className='eyebrow'>
            {kind === 'user' ? 'Test user' : 'Calendar'}
          </p>
          <h2>
            {creating ? 'New' : 'Edit'} {kind}
          </h2>
          {!creating && value && (
            <p>
              <code>{value.id}</code>
            </p>
          )}
        </div>
        {value && (
          <Button
            variant='ghost'
            size='sm'
            disabled={pending}
            icon={create ? <Icon name='xmark' /> : <Icon name='plus' />}
            onClick={() => {
              setError('');
              setCreate(!create);
            }}
          >
            {create ? 'Cancel' : `New ${kind}`}
          </Button>
        )}
      </header>
      <form
        className='panel-body'
        key={`${value?.id}:${creating}`}
        onSubmit={(e) => {
          e.preventDefault();
          const data = Object.fromEntries(new FormData(e.currentTarget));
          setError('');
          const body =
            kind === 'user'
              ? { name: data.name, email: data.email }
              : {
                  summary: data.summary,
                  timeZone: data.timeZone,
                  primary: data.primary === 'on',
                  ...(creating ? { userId } : {}),
                };
          void save(body, creating ? undefined : value?.id)
            .then(() => setCreate(false))
            .catch((e) => setError(e.message));
        }}
      >
        {kind === 'user' ? (
          <>
            <label className='field'>
              <span>Name</span>
              <Input
                aria-label='Name'
                name='name'
                required
                defaultValue={
                  !creating && value && 'name' in value ? value.name : ''
                }
              />
            </label>
            <label className='field'>
              <span>Email</span>
              <Input
                aria-label='Email'
                name='email'
                type='email'
                required
                defaultValue={
                  !creating && value && 'email' in value ? value.email : ''
                }
              />
            </label>
          </>
        ) : (
          <>
            <label className='field'>
              <span>Calendar name</span>
              <Input
                aria-label='Calendar name'
                name='summary'
                required
                defaultValue={
                  !creating && value && 'summary' in value ? value.summary : ''
                }
              />
            </label>
            <label className='field'>
              <span>Time zone</span>
              <Input
                aria-label='Time zone'
                name='timeZone'
                required
                className='mono'
                defaultValue={
                  !creating && value && 'timeZone' in value
                    ? value.timeZone
                    : 'Asia/Tokyo'
                }
              />
            </label>
            <label className='check-label'>
              <input
                name='primary'
                type='checkbox'
                defaultChecked={
                  !creating && value && 'primary' in value
                    ? value.primary
                    : false
                }
              />
              Primary calendar
            </label>
          </>
        )}
        {error && (
          <p role='alert' className='error-message'>
            {error}
          </p>
        )}
        {kind === 'calendar' && !userId && (
          <p className='hint'>Create a test user before adding calendars.</p>
        )}
        <div className='button-row'>
          <Button
            type='submit'
            variant={creating ? 'primary' : 'secondary'}
            disabled={pending || (kind === 'calendar' && !userId)}
          >
            Save {kind}
          </Button>
          {!creating && remove && (
            <Button
              variant='secondary-destructive'
              icon={<Icon name='trash' />}
              disabled={pending}
              onClick={() => {
                if (window.confirm(`Delete this ${kind} and its owned data?`))
                  remove();
              }}
            >
              Delete
            </Button>
          )}
        </div>
      </form>
    </section>
  );
}
