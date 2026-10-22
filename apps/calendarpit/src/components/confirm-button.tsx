import { Button } from '@cloudflare/kumo/components/button';
import { Dialog } from '@cloudflare/kumo/components/dialog';
import type { ReactNode } from 'react';
import { useMessages } from './language';

/** Button variants a confirmation trigger may use. */
type TriggerVariant =
  | 'primary'
  | 'secondary'
  | 'secondary-destructive'
  | 'destructive'
  | 'ghost';

/**
 * Props of {@link ConfirmButton}. A trigger either shows `label`, or is an
 * icon-only square button, which needs `ariaLabel` for its accessible name.
 */
export type ConfirmButtonProps = {
  icon?: ReactNode;
  variant?: TriggerVariant;
  size?: 'sm' | 'base' | 'lg';
  className?: string;
  disabled?: boolean;
  /** Dialog heading, phrased as the question being asked. */
  title: string;
  /** What the action changes, including anything it cannot undo. */
  description: string;
  /** Label of the confirming button, naming the action rather than "OK". */
  confirmLabel: string;
  /** Checks the action before opening; returning false keeps the dialog closed. */
  beforeOpen?: () => boolean;
  confirm: () => void;
} & (
  | {
      /** Trigger text. */
      label: ReactNode;
      /** Accessible name, when the spoken name says more than the label. */
      ariaLabel?: string;
      iconOnly?: false;
    }
  | {
      label?: undefined;
      /** Accessible name of the icon-only trigger. */
      ariaLabel: string;
      iconOnly: true;
    }
);

/**
 * A button that asks for confirmation in a modal alert dialog before running
 * `confirm`. It replaces `window.confirm`, whose dialog is the browser's own:
 * unstyled by the design system, outside the page's focus order, and labelled
 * in the operating system's language.
 *
 * The trigger keeps the accessible name callers give it, so the dialog is an
 * extra step rather than a renamed action.
 */
export function ConfirmButton(props: ConfirmButtonProps) {
  const {
    icon,
    variant = 'secondary-destructive',
    size,
    className,
    disabled,
    title,
    description,
    confirmLabel,
    beforeOpen,
    confirm,
  } = props;
  const t = useMessages();
  const shared = { variant, size, className, disabled, icon };
  return (
    <Dialog.Root
      role='alertdialog'
      onOpenChange={(open, details) => {
        if (open && beforeOpen && !beforeOpen()) details.cancel();
      }}
    >
      <Dialog.Trigger
        render={
          props.iconOnly ? (
            <Button {...shared} shape='square' aria-label={props.ariaLabel} />
          ) : (
            <Button {...shared} aria-label={props.ariaLabel}>
              {props.label}
            </Button>
          )
        }
      />
      <Dialog size='base' className='confirm-dialog'>
        <Dialog.Title className='confirm-title'>{title}</Dialog.Title>
        <Dialog.Description className='confirm-description'>
          {description}
        </Dialog.Description>
        <div className='confirm-actions'>
          <Dialog.Close
            render={<Button variant='ghost'>{t['common.cancel']}</Button>}
          />
          <Dialog.Close
            render={
              // Kumo's `destructive` fills the button with
              // `--color-kumo-danger`, which this app maps to a light red in
              // dark mode; `secondary-destructive` reads in both modes and
              // matches the app's other destructive actions.
              <Button variant='secondary-destructive' onClick={confirm}>
                {confirmLabel}
              </Button>
            }
          />
        </div>
      </Dialog>
    </Dialog.Root>
  );
}
