import type { User } from '@calendarpit/server';
import { Button } from '@cloudflare/kumo/components/button';
import { Input } from '@cloudflare/kumo/components/input';
import { revalidateLogic, useForm } from '@tanstack/react-form';
import { useState } from 'react';
import { FieldError } from '../../../components/field-error';
import { useWorkspaceBusy } from '../../workspace/hooks/use-workspace-mutation';
import { useDeleteUser, useSaveUser } from '../hooks/use-directory-mutations';
import { userFormValues, validateUserForm } from '../models/directory-forms';
import { DeleteButton, EditorPanel } from './editor-panel';

/**
 * Creates or edits a test user. After saving, `saved` receives the user so the
 * screen can select it.
 */
export function UserEditor({
  user,
  saved,
}: {
  user?: User;
  saved: (user: User) => void;
}) {
  const [create, setCreate] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const save = useSaveUser();
  const remove = useDeleteUser();
  const busy = useWorkspaceBusy();
  const creating = create || !user;
  const form = useForm({
    defaultValues: userFormValues(creating ? undefined : user),
    validationLogic: revalidateLogic({
      mode: 'submit',
      modeAfterSubmission: 'change',
    }),
    validators: {
      onDynamic: ({ value }) => {
        const fields = validateUserForm(value);
        return fields ? { fields } : undefined;
      },
    },
    onSubmit: async ({ value }) => {
      const result = await save.mutateAsync({
        id: creating ? undefined : user?.id,
        values: value,
      });
      setCreate(false);
      saved(result);
    },
  });
  return (
    <EditorPanel
      noun='user'
      eyebrow='Test user'
      creating={creating}
      existingId={user?.id}
      disabled={busy}
      toggleCreate={() => {
        setSubmitError('');
        setCreate(!create);
        form.reset(userFormValues(create ? user : undefined));
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
        <form.Field name='name'>
          {(field) => (
            <label className='field'>
              <span>Name</span>
              <Input
                aria-label='Name'
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
              />
              <FieldError errors={field.state.meta.errors} />
            </label>
          )}
        </form.Field>
        <form.Field name='email'>
          {(field) => (
            <label className='field'>
              <span>Email</span>
              <Input
                aria-label='Email'
                type='email'
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
                variant={creating ? 'primary' : 'secondary'}
                loading={submitting}
                disabled={busy}
              >
                Save user
              </Button>
            )}
          </form.Subscribe>
          {!creating && user && (
            <DeleteButton
              noun='user'
              disabled={busy}
              remove={() => remove.mutate(user.id)}
            />
          )}
        </div>
      </form>
    </EditorPanel>
  );
}
