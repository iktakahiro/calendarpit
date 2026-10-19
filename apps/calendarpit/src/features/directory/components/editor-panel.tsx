import { Button } from '@cloudflare/kumo/components/button';
import type { ReactNode } from 'react';
import { ConfirmButton } from '../../../components/confirm-button';
import { Icon } from '../../../components/icon';
import { useMessages } from '../../../components/language';
import type { DirectoryKind } from '../models/directory-forms';

/**
 * The panel around a user or calendar form. With an existing record it offers
 * a toggle between editing it and creating a new one.
 */
export function EditorPanel({
  kind,
  creating,
  existingId,
  disabled,
  toggleCreate,
  children,
}: {
  kind: DirectoryKind;
  creating: boolean;
  /** ID of the record being edited; `undefined` when none exists yet. */
  existingId?: string;
  disabled: boolean;
  toggleCreate: () => void;
  children: ReactNode;
}) {
  const t = useMessages();
  const heading = t[`directory.${kind}.${creating ? 'new' : 'edit'}`];
  return (
    <section className='panel' aria-label={heading}>
      <header className='panel-head'>
        <div>
          <p className='eyebrow'>{t[`directory.${kind}.eyebrow`]}</p>
          <h2>{heading}</h2>
          {!creating && existingId && (
            <p>
              <code>{existingId}</code>
            </p>
          )}
        </div>
        {existingId && (
          <Button
            variant='ghost'
            size='sm'
            disabled={disabled}
            icon={<Icon name={creating ? 'xmark' : 'plus'} />}
            onClick={toggleCreate}
          >
            {creating ? t['common.cancel'] : t[`directory.${kind}.new`]}
          </Button>
        )}
      </header>
      {children}
    </section>
  );
}

/** Delete button that asks for confirmation first. */
export function DeleteButton({
  kind,
  disabled,
  remove,
}: {
  kind: DirectoryKind;
  disabled: boolean;
  remove: () => void;
}) {
  const t = useMessages();
  return (
    <ConfirmButton
      label={t['common.delete']}
      icon={<Icon name='trash' />}
      disabled={disabled}
      title={t[`directory.${kind}.deleteTitle`]}
      description={t[`directory.${kind}.deleteDescription`]}
      confirmLabel={t[`directory.${kind}.deleteConfirm`]}
      confirm={remove}
    />
  );
}
