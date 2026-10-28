import type { Calendar } from '@calendarpit/server';
import { Button } from '@cloudflare/kumo/components/button';
import { Checkbox } from '@cloudflare/kumo/components/checkbox';
import { Input } from '@cloudflare/kumo/components/input';
import { revalidateLogic, useForm } from '@tanstack/react-form';
import { useId, useState } from 'react';
import { FieldError } from '../../../components/field-error';
import { useMessages } from '../../../components/language';
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
  const t = useMessages();
  const creating = create || !calendar;
  const idPrefix = useId();
  const form = useForm({
    defaultValues: calendarFormValues(creating ? undefined : calendar),
    validationLogic: revalidateLogic({
      mode: 'submit',
      modeAfterSubmission: 'change',
    }),
    validators: {
      onDynamic: ({ value }) => {
        const fields = validateCalendarForm(value, t);
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
      kind='calendar'
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
          {(field) => {
            const errorId = `${idPrefix}-summary-error`;
            const invalid = Boolean(field.state.meta.errors[0]);
            return (
              <label className='field'>
                <span>{t['directory.calendar.name']}</span>
                <Input
                  aria-label={t['directory.calendar.name']}
                  value={field.state.value}
                  aria-invalid={invalid || undefined}
                  aria-describedby={invalid ? errorId : undefined}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                <FieldError id={errorId} errors={field.state.meta.errors} />
              </label>
            );
          }}
        </form.Field>
        <form.Field name='timeZone'>
          {(field) => {
            const errorId = `${idPrefix}-timeZone-error`;
            const invalid = Boolean(field.state.meta.errors[0]);
            return (
              <label className='field'>
                <span>{t['directory.calendar.timeZone']}</span>
                <Input
                  aria-label={t['directory.calendar.timeZone']}
                  className='mono'
                  value={field.state.value}
                  aria-invalid={invalid || undefined}
                  aria-describedby={invalid ? errorId : undefined}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                <FieldError id={errorId} errors={field.state.meta.errors} />
              </label>
            );
          }}
        </form.Field>
        <form.Field name='primary'>
          {(field) => (
            <Checkbox
              label={t['directory.calendar.primary']}
              checked={field.state.value}
              onCheckedChange={(checked: boolean) =>
                field.handleChange(checked)
              }
            />
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
                {t['directory.calendar.save']}
              </Button>
            )}
          </form.Subscribe>
          {!creating && calendar && (
            <DeleteButton
              kind='calendar'
              disabled={busy}
              remove={() => remove.mutate(calendar.id)}
            />
          )}
        </div>
      </form>
    </EditorPanel>
  );
}
