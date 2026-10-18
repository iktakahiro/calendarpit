import type { Calendar, CalendarEvent } from '@calendarpit/server';
import { Button } from '@cloudflare/kumo/components/button';
import { Input } from '@cloudflare/kumo/components/input';
import { revalidateLogic, useForm } from '@tanstack/react-form';
import { useEffect, useRef, useState } from 'react';
import { FieldError } from '../../../components/field-error';
import { Icon } from '../../../components/icon';
import { useSaveEvent } from '../hooks/use-event-mutations';
import {
  eventFormValues,
  toEventBody,
  toggleAllDay,
  validateEventForm,
} from '../models/event-form';

/**
 * Creates or replaces an event in `calendar`. Times are edited in the
 * calendar's zone. Escape closes the editor; focus moves into it on open.
 */
export function EventEditor({
  calendar,
  event,
  date,
  at,
  close,
}: {
  calendar: Calendar;
  /** The event to edit; `undefined` creates a new one. */
  event?: CalendarEvent;
  /** Date a new event starts on. */
  date: string;
  /** Local start a new event takes from the week grid, `YYYY-MM-DDTHH:mm`. */
  at?: string;
  close: () => void;
}) {
  const [submitError, setSubmitError] = useState('');
  const save = useSaveEvent();
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    // Move focus into the editor so keyboard and narrow-screen users land on it.
    panel.current?.focus({ preventScroll: true });
    panel.current?.scrollIntoView({ block: 'nearest' });
  }, []);
  const form = useForm({
    defaultValues: eventFormValues(calendar, date, event, at),
    validationLogic: revalidateLogic({
      mode: 'submit',
      modeAfterSubmission: 'change',
    }),
    validators: {
      onDynamic: ({ value }) => {
        const fields = validateEventForm(value);
        return fields ? { fields } : undefined;
      },
    },
    onSubmit: async ({ value }) => {
      await save.mutateAsync({
        calendarId: calendar.id,
        id: event?.id,
        body: toEventBody(value, calendar),
      });
      close();
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
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitError('');
          form
            .handleSubmit()
            .catch((error: unknown) =>
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
                onBlur={field.handleBlur}
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
                    const next = toggleAllDay(
                      {
                        start: form.getFieldValue('start'),
                        end: form.getFieldValue('end'),
                      },
                      e.target.checked,
                    );
                    form.setFieldValue('start', next.start);
                    form.setFieldValue('end', next.end);
                  }}
                />
                All-day event
              </label>
            )}
          </form.Field>
          <form.Subscribe selector={(state) => state.values.allDay}>
            {(allDay) => (
              <div className='form-row'>
                {(['start', 'end'] as const).map((name) => {
                  const label =
                    name === 'start'
                      ? 'Start'
                      : allDay
                        ? 'End (exclusive)'
                        : 'End';
                  return (
                    <form.Field name={name} key={name}>
                      {(field) => (
                        <label className='field'>
                          <span>{label}</span>
                          <Input
                            aria-label={label}
                            type={allDay ? 'date' : 'datetime-local'}
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(e.target.value)}
                          />
                          <FieldError errors={field.state.meta.errors} />
                        </label>
                      )}
                    </form.Field>
                  );
                })}
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
                onBlur={field.handleBlur}
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
                onBlur={field.handleBlur}
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
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
              />
              <FieldError errors={field.state.meta.errors} />
            </label>
          )}
        </form.Field>
        {submitError && (
          <p className='error-message' role='alert'>
            {submitError}
          </p>
        )}
        <div className='editor-actions'>
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(submitting) => (
              <Button type='submit' variant='primary' loading={submitting}>
                Save event
              </Button>
            )}
          </form.Subscribe>
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
