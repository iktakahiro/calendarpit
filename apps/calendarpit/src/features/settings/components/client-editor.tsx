import { Button } from '@cloudflare/kumo/components/button';
import { Input, InputArea } from '@cloudflare/kumo/components/input';
import { revalidateLogic, useForm } from '@tanstack/react-form';
import { useState } from 'react';
import { FieldError } from '../../../components/field-error';
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
  const creating = !client;
  const form = useForm({
    defaultValues: clientFormValues(client),
    validationLogic: revalidateLogic({
      mode: 'submit',
      modeAfterSubmission: 'change',
    }),
    validators: {
      onDynamic: ({ value }) => {
        const fields = validateClientForm(value, creating);
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
      aria-label={creating ? 'New OAuth client' : `Edit ${client.id}`}
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
          {(field) => (
            <label className='field'>
              <span>Client ID</span>
              <Input
                aria-label='Client ID'
                className='mono'
                spellCheck={false}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
              />
              <FieldError errors={field.state.meta.errors} />
            </label>
          )}
        </form.Field>
      )}
      <form.Field name='secret'>
        {(field) => (
          <label className='field'>
            <span>Client secret</span>
            <Input
              aria-label='Client secret'
              className='mono'
              autoComplete='off'
              spellCheck={false}
              placeholder={
                creating ? undefined : 'Leave blank to keep the current secret'
              }
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
            />
            <FieldError errors={field.state.meta.errors} />
          </label>
        )}
      </form.Field>
      <form.Field name='redirectUris'>
        {(field) => (
          <label className='field'>
            <span>Redirect URIs, one per line</span>
            <InputArea
              aria-label='Redirect URIs'
              className='mono'
              rows={3}
              spellCheck={false}
              placeholder='http://127.0.0.1:3000/auth/google/callback'
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
            />
            <FieldError errors={field.state.meta.errors} />
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
              variant='primary'
              loading={submitting}
              disabled={busy}
            >
              Save client
            </Button>
          )}
        </form.Subscribe>
        <Button variant='secondary' disabled={busy} onClick={done}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
