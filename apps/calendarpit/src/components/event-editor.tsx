import { useEffect, useRef, useState } from 'react';
import { Button } from '@cloudflare/kumo/components/button';
import { Input } from '@cloudflare/kumo/components/input';
import { useForm } from '@tanstack/react-form';
import type { Calendar, CalendarEvent } from '@calendarpit/server';
import { Icon } from './icon';

export function localTime(value: string, timeZone: string) {
  if (!/[zZ]|[+-]\d{2}:\d{2}$/.test(value)) return value.slice(0, 16);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(value));
  const p = Object.fromEntries(parts.map((v) => [v.type, v.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
export function EventEditor({
  calendar,
  event,
  date,
  save,
  close,
  pending,
}: {
  calendar: Calendar;
  event?: CalendarEvent;
  date: string;
  save: (body: unknown, id?: string) => Promise<void>;
  close: () => void;
  pending: boolean;
}) {
  const [submitError, setSubmitError] = useState('');
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    // Move focus into the editor so keyboard and narrow-screen users land on it.
    panel.current?.focus({ preventScroll: true });
    panel.current?.scrollIntoView({ block: 'nearest' });
  }, []);
  const form = useForm({
    defaultValues: {
      summary: event?.summary ?? '',
      description: event?.description ?? '',
      location: event?.location ?? '',
      allDay: !!event?.start.date,
      start:
        event?.start.date ??
        (event?.start.dateTime
          ? localTime(event.start.dateTime, calendar.timeZone)
          : `${date}T10:00`),
      end:
        event?.end.date ??
        (event?.end.dateTime
          ? localTime(event.end.dateTime, calendar.timeZone)
          : `${date}T11:00`),
      transparency: event?.transparency ?? 'opaque',
      extendedProperties: JSON.stringify(
        event?.extendedProperties ?? {},
        null,
        2,
      ),
    },
    onSubmit: async ({ value }) => {
      let extendedProperties: unknown;
      try {
        extendedProperties = JSON.parse(value.extendedProperties);
      } catch {
        throw new Error('Extended properties must be valid JSON.');
      }
      await save(
        {
          summary: value.summary,
          description: value.description,
          location: value.location,
          start: value.allDay
            ? { date: value.start.slice(0, 10) }
            : { dateTime: value.start, timeZone: calendar.timeZone },
          end: value.allDay
            ? { date: value.end.slice(0, 10) }
            : { dateTime: value.end, timeZone: calendar.timeZone },
          transparency: value.transparency,
          extendedProperties,
        },
        event?.id,
      );
    },
  });
  return (
    <section
      ref={panel}
      tabIndex={-1}
      className='editor-panel'
      aria-label='Event editor'
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          close();
        }
      }}
    >
      <div className='panel-title'>
        <div>
          <p className='eyebrow'>{event ? 'Edit event' : 'New event'}</p>
          <h2>{event ? event.summary || '(Untitled event)' : 'A new event'}</h2>
          <p className='panel-subtitle'>
            {calendar.summary} · <code>{calendar.timeZone}</code>
          </p>
        </div>
        <Button
          variant='ghost'
          size='sm'
          icon={<Icon name='xmark' />}
          onClick={close}
        >
          Close
        </Button>
      </div>
      <form
        className='editor-form'
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitError('');
          void form
            .handleSubmit()
            .catch((error) =>
              setSubmitError(
                error instanceof Error
                  ? error.message
                  : 'Could not save event.',
              ),
            );
        }}
      >
        <form.Field name='summary'>
          {(field) => (
            <label className='field'>
              <span>Summary</span>
              <Input
                aria-label='Summary'
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            </label>
          )}
        </form.Field>
        <fieldset className='field-group'>
          <legend>When</legend>
          <form.Field name='allDay'>
            {(field) => (
              <label className='check-label'>
                <input
                  type='checkbox'
                  checked={field.state.value}
                  onChange={(e) => {
                    field.handleChange(e.target.checked);
                    if (e.target.checked) {
                      const start = form.getFieldValue('start').slice(0, 10);
                      form.setFieldValue('start', start);
                      const next = new Date(`${start}T12:00:00Z`);
                      next.setUTCDate(next.getUTCDate() + 1);
                      form.setFieldValue(
                        'end',
                        next.toISOString().slice(0, 10),
                      );
                    } else {
                      form.setFieldValue(
                        'start',
                        form.getFieldValue('start').slice(0, 10) + 'T10:00',
                      );
                      form.setFieldValue(
                        'end',
                        form.getFieldValue('end').slice(0, 10) + 'T11:00',
                      );
                    }
                  }}
                />
                All-day event
              </label>
            )}
          </form.Field>
          <form.Subscribe selector={(s) => s.values.allDay}>
            {(allDay) => (
              <div className='form-row'>
                {(['start', 'end'] as const).map((name) => (
                  <form.Field name={name} key={name}>
                    {(field) => (
                      <label className='field'>
                        <span>
                          {name === 'start'
                            ? 'Start'
                            : allDay
                              ? 'End (exclusive)'
                              : 'End'}
                        </span>
                        <Input
                          aria-label={
                            name === 'start'
                              ? 'Start'
                              : allDay
                                ? 'End (exclusive)'
                                : 'End'
                          }
                          type={allDay ? 'date' : 'datetime-local'}
                          required
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                        />
                      </label>
                    )}
                  </form.Field>
                ))}
              </div>
            )}
          </form.Subscribe>
        </fieldset>
        <form.Field name='transparency'>
          {(field) => (
            <label className='field'>
              <span>Availability</span>
              <select
                value={field.state.value}
                onChange={(e) =>
                  field.handleChange(e.target.value as 'opaque' | 'transparent')
                }
              >
                <option value='opaque'>Busy</option>
                <option value='transparent'>Free</option>
              </select>
            </label>
          )}
        </form.Field>
        <form.Field name='location'>
          {(field) => (
            <label className='field'>
              <span>Location</span>
              <Input
                aria-label='Location'
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            </label>
          )}
        </form.Field>
        <form.Field name='description'>
          {(field) => (
            <label className='field'>
              <span>Description</span>
              <textarea
                rows={3}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            </label>
          )}
        </form.Field>
        <form.Field name='extendedProperties'>
          {(field) => (
            <label className='field'>
              <span>Extended properties (JSON)</span>
              <textarea
                className='mono'
                rows={4}
                spellCheck={false}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
              />
              {field.state.meta.errors.length > 0 && (
                <span role='alert'>{field.state.meta.errors.join(', ')}</span>
              )}
            </label>
          )}
        </form.Field>
        {submitError && (
          <p className='error-message' role='alert'>
            {submitError}
          </p>
        )}
        <div className='editor-actions'>
          <Button type='submit' variant='primary' loading={pending}>
            Save event
          </Button>
          <span className='hint'>
            <kbd>Esc</kbd> to close
          </span>
        </div>
        {event && (
          <dl className='event-facts'>
            <div>
              <dt>ID</dt>
              <dd>
                <code>{event.id}</code>
              </dd>
            </div>
            <div>
              <dt>ETag</dt>
              <dd>
                <code>{event.etag}</code>
              </dd>
            </div>
            <div>
              <dt>Updated</dt>
              <dd>
                <code>{new Date(event.updated).toLocaleString('en')}</code>
              </dd>
            </div>
          </dl>
        )}
      </form>
    </section>
  );
}
