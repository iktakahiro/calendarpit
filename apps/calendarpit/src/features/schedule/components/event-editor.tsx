import type { Calendar, CalendarEvent } from '@calendarpit/server';
import { Button } from '@cloudflare/kumo/components/button';
import { Checkbox } from '@cloudflare/kumo/components/checkbox';
import { Input, InputArea } from '@cloudflare/kumo/components/input';
import { Select } from '@cloudflare/kumo/components/select';
import { revalidateLogic, useForm } from '@tanstack/react-form';
import { useEffect, useRef, useState } from 'react';
import { FieldError } from '../../../components/field-error';
import { Icon } from '../../../components/icon';
import { useLocale, useMessages } from '../../../components/language';
import { useSaveEvent } from '../hooks/use-event-mutations';
import { DateTimeField } from './date-time-field';
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
  const t = useMessages();
  const locale = useLocale();
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
        const fields = validateEventForm(value, t);
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
      aria-label={t['event.editor']}
      // Typing a title right after opening must not trigger a shortcut.
      data-command-keys='off'
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          close();
        }
      }}
    >
      <div className='panel-title'>
        <div>
          <p className='eyebrow'>{event ? t['event.edit'] : t['event.new']}</p>
          <h2>
            {event
              ? event.summary || t['common.untitled']
              : t['event.newTitle']}
          </h2>
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
          {t['common.close']}
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
                error instanceof Error ? error.message : t['event.saveFailed'],
              ),
            );
        }}
      >
        <form.Field name='summary'>
          {(field) => (
            <label className='field'>
              <span>{t['event.summary']}</span>
              <Input
                aria-label={t['event.summary']}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            </label>
          )}
        </form.Field>
        <fieldset className='field-group'>
          <legend>{t['event.when']}</legend>
          <form.Field name='allDay'>
            {(field) => (
              <Checkbox
                label={t['event.allDay']}
                checked={field.state.value}
                onCheckedChange={(checked: boolean) => {
                  field.handleChange(checked);
                  const next = toggleAllDay(
                    {
                      start: form.getFieldValue('start'),
                      end: form.getFieldValue('end'),
                    },
                    checked,
                  );
                  form.setFieldValue('start', next.start);
                  form.setFieldValue('end', next.end);
                }}
              />
            )}
          </form.Field>
          <form.Subscribe selector={(state) => state.values.allDay}>
            {(allDay) =>
              (['start', 'end'] as const).map((name) => {
                // The spoken names stay "Start" and "End" in every mode; only
                // the visible label says that an all-day end is exclusive.
                const end = name === 'end';
                const spoken = end ? t['event.end'] : t['event.start'];
                return (
                  <form.Field name={name} key={name}>
                    {(field) => (
                      <div className='field'>
                        <span>
                          {allDay && end ? t['event.endExclusive'] : spoken}
                        </span>
                        <DateTimeField
                          name={spoken}
                          value={field.state.value}
                          allDay={allDay}
                          change={(value) => field.handleChange(value)}
                          blur={field.handleBlur}
                        />
                        <FieldError errors={field.state.meta.errors} />
                      </div>
                    )}
                  </form.Field>
                );
              })
            }
          </form.Subscribe>
        </fieldset>
        <form.Field name='transparency'>
          {(field) => (
            <div className='field'>
              <span id='availability-label'>{t['event.availability']}</span>
              <Select
                aria-labelledby='availability-label'
                value={field.state.value}
                onValueChange={(value: 'opaque' | 'transparent' | null) =>
                  value && field.handleChange(value)
                }
                items={{
                  opaque: t['common.busy'],
                  transparent: t['common.free'],
                }}
              />
            </div>
          )}
        </form.Field>
        <form.Field name='location'>
          {(field) => (
            <label className='field'>
              <span>{t['event.location']}</span>
              <Input
                aria-label={t['event.location']}
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
              <span>{t['event.description']}</span>
              <InputArea
                aria-label={t['event.description']}
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
              <span>{t['event.extendedProperties']}</span>
              <InputArea
                aria-label={t['event.extendedProperties']}
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
                {t['event.save']}
              </Button>
            )}
          </form.Subscribe>
          <span className='hint'>
            <kbd>Esc</kbd>
            {t['event.escToClose']}
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
              <dt>{t['event.updated']}</dt>
              <dd>
                <code>{new Date(event.updated).toLocaleString(locale)}</code>
              </dd>
            </div>
          </dl>
        )}
      </form>
    </section>
  );
}
