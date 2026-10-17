import type { Calendar } from '@calendarpit/server';
import { Button } from '@cloudflare/kumo/components/button';
import { Input } from '@cloudflare/kumo/components/input';
import { revalidateLogic, useForm } from '@tanstack/react-form';
import { useState } from 'react';
import { FieldError } from '../../../components/field-error';
import { useWorkspaceBusy } from '../../workspace/hooks/use-workspace-mutation';
import {
  useDeleteCalendar,
  useSaveCalendar,
} from '../hooks/use-directory-mutations';
import {
  calendarFormValues,
  validateCalendarForm,
} from '../models/directory-forms';
import { DeleteButton, EditorPanel } from './editor-panel';

/**
 * Creates a calendar for `userId` or edits `calendar`. After saving, `saved`
 * receives the calendar so the screen can select it.
 */
export function CalendarEditor({
  userId,
  calendar,
  saved,
}: {
  userId: string;
  calendar?: Calendar;
  saved: (calendar: Calendar) => void;
}) {
  const [create, setCreate] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const save = useSaveCalendar();
  const remove = useDeleteCalendar();
  const busy = useWorkspaceBusy();
  const creating = create || !calendar;
  const form = useForm({
    defaultValues: calendarFormValues(creating ? undefined : calendar),
    validationLogic: revalidateLogic({
      mode: 'submit',
      modeAfterSubmission: 'change',
    }),
    validators: {
      onDynamic: ({ value }) => {
        const fields = validateCalendarForm(value);
        return fields ? { fields } : undefined;
      },
    },
    onSubmit: async ({ value }) => {
      const result = await save.mutateAsync({
        id: creating ? undefined : calendar?.id,
        userId,
        values: value,
      });
      setCreate(false);
      saved(result);
    },
  });
  return (
    <EditorPanel
      noun='calendar'
      eyebrow='Calendar'
      creating={creating}
      existingId={calendar?.id}
      disabled={busy}
      toggleCreate={() => {
        setSubmitError('');
        setCreate(!create);
        form.reset(calendarFormValues(create ? calendar : undefined));
      }}
    >
      <form
        className='panel-body'
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitError('');
          form
            .handleSubmit()
            .catch((error: unknown) =>
              setSubmitError(error instanceof Error ? error.message : ''),
            );
        }}
      >
        <form.Field name='summary'>
          {(field) => (
            <label className='field'>
              <span>Calendar name</span>
              <Input
                aria-label='Calendar name'
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
              />
              <FieldError errors={field.state.meta.errors} />
            </label>
          )}
        </form.Field>
        <form.Field name='timeZone'>
          {(field) => (
            <label className='field'>
              <span>Time zone</span>
              <Input
                aria-label='Time zone'
                className='mono'
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
              />
              <FieldError errors={field.state.meta.errors} />
            </label>
          )}
        </form.Field>
        <form.Field name='primary'>
          {(field) => (
            <label className='check-label'>
              <input
                type='checkbox'
                checked={field.state.value}
                onChange={(e) => field.handleChange(e.target.checked)}
              />
              Primary calendar
            </label>
          )}
        </form.Field>
        {submitError && (
          <p role='alert' className='error-message'>
            {submitError}
          </p>
        )}
        <div className='button-row'>
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(submitting) => (
              <Button
                type='submit'
                variant={creating ? 'primary' : 'secondary'}
                loading={submitting}
                disabled={busy}
              >
                Save calendar
              </Button>
            )}
          </form.Subscribe>
          {!creating && calendar && (
            <DeleteButton
              noun='calendar'
              disabled={busy}
              remove={() => remove.mutate(calendar.id)}
            />
          )}
        </div>
      </form>
    </EditorPanel>
  );
}
