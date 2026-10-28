import { Button } from '@cloudflare/kumo/components/button';
import { Input, InputArea } from '@cloudflare/kumo/components/input';
import { revalidateLogic, useForm } from '@tanstack/react-form';
import { useId, useState } from 'react';
import { FieldError } from '../../../components/field-error';
import { useMessages } from '../../../components/language';
import { useWorkspaceBusy } from '../../workspace/hooks/use-workspace-mutation';
import { useSaveClient } from '../hooks/use-clients';
import {
  clientFormValues,
  clientPayload,
  validateClientForm,
  type ClientSummary,
} from '../models/client-form';

/**
 * Registers a new OAuth client, or edits the secret and redirect URIs of
 * `client`. `done` runs after a save or cancel.
 */
export function ClientEditor({
  client,
  done,
}: {
  client?: ClientSummary;
  done: () => void;
}) {
  const [submitError, setSubmitError] = useState('');
  const save = useSaveClient();
  const busy = useWorkspaceBusy();
  const t = useMessages();
  const creating = !client;
  const idPrefix = useId();
  const form = useForm({
    defaultValues: clientFormValues(client),
    validationLogic: revalidateLogic({
      mode: 'submit',
      modeAfterSubmission: 'change',
    }),
    validators: {
      onDynamic: ({ value }) => {
        const fields = validateClientForm(value, creating, t);
        return fields ? { fields } : undefined;
      },
    },
    onSubmit: async ({ value }) => {
      await save.mutateAsync({
        id: client?.id,
        body: clientPayload(value, creating),
      });
      done();
    },
  });
  return (
    <form
      className='panel-body client-editor'
      aria-label={
        creating ? t['clients.newForm'] : t['clients.edit'](client.id)
      }
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
      {creating && (
        <form.Field name='id'>
          {(field) => {
            const errorId = `${idPrefix}-id-error`;
            const invalid = Boolean(field.state.meta.errors[0]);
            return (
              <label className='field'>
                <span>{t['clients.id']}</span>
                <Input
                  aria-label={t['clients.id']}
                  className='mono'
                  spellCheck={false}
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
      )}
      <form.Field name='secret'>
        {(field) => {
          const errorId = `${idPrefix}-secret-error`;
          const invalid = Boolean(field.state.meta.errors[0]);
          return (
            <label className='field'>
              <span>{t['clients.secret']}</span>
              <Input
                aria-label={t['clients.secret']}
                className='mono'
                autoComplete='off'
                spellCheck={false}
                placeholder={creating ? undefined : t['clients.keepSecret']}
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
      <form.Field name='redirectUris'>
        {(field) => {
          const errorId = `${idPrefix}-redirectUris-error`;
          const invalid = Boolean(field.state.meta.errors[0]);
          return (
            <label className='field'>
              <span>{t['clients.redirectUrisField']}</span>
              <InputArea
                aria-label={t['clients.redirectUris']}
                className='mono'
                rows={3}
                spellCheck={false}
                placeholder='http://127.0.0.1:3000/auth/google/callback'
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
              variant='primary'
              loading={submitting}
              disabled={busy}
            >
              {t['clients.save']}
            </Button>
          )}
        </form.Subscribe>
        <Button variant='secondary' disabled={busy} onClick={done}>
          {t['common.cancel']}
        </Button>
      </div>
    </form>
  );
}
