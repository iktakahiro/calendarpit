import { Button } from '@cloudflare/kumo/components/button';
import { Input } from '@cloudflare/kumo/components/input';
import { Select } from '@cloudflare/kumo/components/select';
import { revalidateLogic, useForm } from '@tanstack/react-form';
import { useState } from 'react';
import { ConfirmButton } from '../../../components/confirm-button';
import { FieldError } from '../../../components/field-error';
import { Icon } from '../../../components/icon';
import { useMessages } from '../../../components/language';
import { serverMessage } from '../../../lib/management-client';
import { useWorkspaceBusy } from '../../workspace/hooks/use-workspace-mutation';
import { useAddFault, useClearFaults, useFaults } from '../hooks/use-faults';
import {
  faultCount,
  faultKinds,
  faultStatuses,
  type FaultTarget,
} from '../models/faults';

/** Configures the process-local simulated failure queue. */
export function FaultsPanel() {
  const t = useMessages();
  const faults = useFaults();
  const add = useAddFault();
  const clear = useClearFaults();
  const busy = useWorkspaceBusy();
  const [submitError, setSubmitError] = useState('');
  const [clearError, setClearError] = useState('');
  const form = useForm({
    defaultValues: {
      target: 'token' as FaultTarget,
      kind: 'admin_policy_enforced' as string,
      count: '1',
    },
    validationLogic: revalidateLogic({
      mode: 'submit',
      modeAfterSubmission: 'change',
    }),
    validators: {
      onDynamic: ({ value }) =>
        faultCount(value.count) === undefined
          ? { fields: { count: t['settings.faultsCountError'] } }
          : undefined,
    },
    onSubmit: async ({ value }) => {
      await add.mutateAsync({
        target: value.target,
        kind: value.kind,
        times: faultCount(value.count)!,
      });
    },
  });
  const occurrences = new Map<string, number>();
  const targetLabels = {
    token: t['settings.faultsToken'],
    calendar: t['settings.faultsCalendar'],
  };
  return (
    <section className='panel' aria-labelledby='faults-title'>
      <header className='panel-head'>
        <div>
          <h2 id='faults-title'>{t['settings.faultsTitle']}</h2>
          <p>{t['settings.faultsDescription']}</p>
          <p>{t['settings.faultsEffects']}</p>
        </div>
        <Icon name='gear' />
      </header>
      <div className='panel-body'>
        <div className='queue-section'>
          <div className='queue-head'>
            <h3>{t['settings.faultsQueue']}</h3>
            <ConfirmButton
              label={t['settings.faultsClear']}
              disabled={busy || !faults.data?.faults.length}
              title={t['settings.faultsClearTitle']}
              description={t['settings.faultsClearDescription']}
              confirmLabel={t['settings.faultsClear']}
              confirm={() => {
                setClearError('');
                clear
                  .mutateAsync(undefined)
                  .catch((error: unknown) =>
                    setClearError(
                      serverMessage(error) ?? t['settings.faultsClearError'],
                    ),
                  );
              }}
            />
          </div>
          {clearError && (
            <p role='alert' className='error-message'>
              {clearError}
            </p>
          )}
          {faults.isPending ? (
            <p>{t['settings.faultsLoading']}</p>
          ) : faults.isError ? (
            <p role='alert' className='error-message'>
              {serverMessage(faults.error) ?? t['settings.faultsLoadError']}
            </p>
          ) : faults.data.faults.length ? (
            <ol
              className='settings-notes'
              aria-label={t['settings.faultsQueue']}
            >
              {faults.data.faults.map((fault) => {
                const base = `${fault.target}-${fault.kind}`;
                const occurrence = (occurrences.get(base) ?? 0) + 1;
                occurrences.set(base, occurrence);
                return (
                  <li key={`${base}-${occurrence}`}>
                    <strong>{targetLabels[fault.target]}</strong> ·{' '}
                    <code>{fault.kind}</code> (HTTP {faultStatuses[fault.kind]})
                    · {t['settings.faultsRemaining'](fault.times)}
                  </li>
                );
              })}
            </ol>
          ) : (
            <p>{t['settings.faultsEmpty']}</p>
          )}
        </div>
        <form
          className='stack'
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            setSubmitError('');
            void form
              .handleSubmit()
              .catch((error: unknown) =>
                setSubmitError(
                  serverMessage(error) ?? t['settings.faultsAddError'],
                ),
              );
          }}
        >
          <form.Field name='target'>
            {(field) => (
              <label className='field'>
                <span id='fault-target-label'>
                  {t['settings.faultsTarget']}
                </span>
                <Select
                  aria-labelledby='fault-target-label'
                  value={field.state.value}
                  disabled={busy}
                  items={targetLabels}
                  onValueChange={(value: FaultTarget | null) => {
                    if (value) {
                      field.handleChange(value);
                      form.setFieldValue('kind', faultKinds[value][0]);
                    }
                  }}
                />
              </label>
            )}
          </form.Field>
          <form.Subscribe selector={(state) => state.values.target}>
            {(target) => (
              <form.Field name='kind'>
                {(field) => (
                  <label className='field'>
                    <span id='fault-kind-label'>
                      {t['settings.faultsKind']}
                    </span>
                    <Select
                      aria-labelledby='fault-kind-label'
                      value={field.state.value}
                      disabled={busy}
                      items={Object.fromEntries(
                        faultKinds[target].map((kind) => [
                          kind,
                          `${kind} (HTTP ${faultStatuses[kind]})`,
                        ]),
                      )}
                      onValueChange={(value: string | null) => {
                        if (value) field.handleChange(value);
                      }}
                    />
                  </label>
                )}
              </form.Field>
            )}
          </form.Subscribe>
          <form.Field name='count'>
            {(field) => (
              <label className='field'>
                <span>{t['settings.faultsCount']}</span>
                <Input
                  aria-label={t['settings.faultsCount']}
                  type='number'
                  min={1}
                  max={100}
                  value={field.state.value}
                  disabled={busy}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
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
                  disabled={busy}
                  loading={submitting}
                >
                  {t['settings.faultsAdd']}
                </Button>
              )}
            </form.Subscribe>
          </div>
        </form>
      </div>
    </section>
  );
}
