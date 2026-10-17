import { Button } from '@cloudflare/kumo/components/button';
import type { ReactNode } from 'react';
import { Icon } from '../../../components/icon';

/**
 * The panel around a user or calendar form. With an existing record it offers
 * a toggle between editing it and creating a new one.
 */
export function EditorPanel({
  noun,
  eyebrow,
  creating,
  existingId,
  disabled,
  toggleCreate,
  children,
}: {
  noun: string;
  eyebrow: string;
  creating: boolean;
  /** ID of the record being edited; `undefined` when none exists yet. */
  existingId?: string;
  disabled: boolean;
  toggleCreate: () => void;
  children: ReactNode;
}) {
  return (
    <section
      className='panel'
      aria-label={`${creating ? 'New' : 'Edit'} ${noun}`}
    >
      <header className='panel-head'>
        <div>
          <p className='eyebrow'>{eyebrow}</p>
          <h2>
            {creating ? 'New' : 'Edit'} {noun}
          </h2>
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
            {creating ? 'Cancel' : `New ${noun}`}
          </Button>
        )}
      </header>
      {children}
    </section>
  );
}

/** Delete button that asks for confirmation first. */
export function DeleteButton({
  noun,
  disabled,
  remove,
}: {
  noun: string;
  disabled: boolean;
  remove: () => void;
}) {
  return (
    <Button
      variant='secondary-destructive'
      icon={<Icon name='trash' />}
      disabled={disabled}
      onClick={() => {
        if (window.confirm(`Delete this ${noun} and its owned data?`)) remove();
      }}
    >
      Delete
    </Button>
  );
}
