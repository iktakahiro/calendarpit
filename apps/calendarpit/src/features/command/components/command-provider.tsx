import { useEffect, useState, type ReactNode } from 'react';
import {
  CommandContext,
  createCommandStore,
  type CommandContextValue,
} from '../hooks/use-commands';
import { matchesShortcut, usesModifier } from '../models/shortcut';
import { CommandPalette } from './command-palette';

/** Opens the palette from anywhere, including while typing. */
const paletteShortcut = 'Mod+K';
/** Opens the palette as a shortcut reference, like many web apps. */
const helpShortcut = '?';

const editable =
  'input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="textbox"], [role="combobox"], [role="spinbutton"], [role="listbox"], [role="menu"], form, [data-command-keys="off"]';

/** Whether a single-key shortcut would steal a key meant for `target`. */
const ownsKeys = (target: EventTarget | null) =>
  target instanceof Element && !!target.closest(editable);

/**
 * Whether a dialog, such as a confirmation or a popover, has the keyboard.
 * A dialog that is still animating closed does not count.
 */
const dialogOpen = () =>
  !!document.querySelector(
    ':is([role="dialog"], [role="alertdialog"], [aria-modal="true"]):not([data-closed], [data-ending-style])',
  );

type PaletteState = {
  open: boolean;
  /** Counts openings, so each one starts with an empty query. */
  session: number;
  /** ID of the command whose page is shown. */
  pageOf?: string;
};

/**
 * Returns the palette open on `pageOf`. Opening a closed palette starts a new
 * session: its content may still be mounted for the closing animation, and
 * must not keep the previous query.
 */
const opened = (current: PaletteState, pageOf?: string): PaletteState => ({
  open: true,
  session: current.open ? current.session : current.session + 1,
  pageOf,
});

/**
 * Provides command registration to its children, renders the command
 * palette, and runs registered shortcuts from one document key listener.
 *
 * Single-key shortcuts are ignored while a field, a form, a list, or a dialog
 * has the keyboard, and inside any element marked `data-command-keys="off"`,
 * such as an editor where a stray key would discard unsaved input. `Mod+` shortcuts also work in fields, but not under a
 * dialog. ⌘K or Ctrl+K toggles the palette, and `?` opens it.
 */
export function CommandProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createCommandStore);
  const [palette, setPalette] = useState<PaletteState>({
    open: false,
    session: 0,
  });
  // `setPalette` is stable, so these never change and the context stays put.
  const [{ show, close }] = useState(() => ({
    show: (pageOf?: string) => setPalette((current) => opened(current, pageOf)),
    close: () => setPalette((current) => ({ ...current, open: false })),
  }));
  const [context] = useState<CommandContextValue>(() => ({
    store,
    openPalette: show,
  }));

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (matchesShortcut(event, paletteShortcut)) {
        event.preventDefault();
        const blocked = dialogOpen();
        // The palette is a dialog too, so it can always close itself.
        setPalette((current) =>
          current.open
            ? { ...current, open: false }
            : blocked
              ? current
              : opened(current),
        );
        return;
      }
      if (dialogOpen()) return;
      const typing = ownsKeys(event.target);
      if (!typing && matchesShortcut(event, helpShortcut)) {
        event.preventDefault();
        show();
        return;
      }
      const command = store
        .commands()
        .find(
          (c) =>
            c.shortcut &&
            !c.disabled &&
            (!typing || usesModifier(c.shortcut)) &&
            matchesShortcut(event, c.shortcut),
        );
      if (!command) return;
      event.preventDefault();
      if (command.page) show(command.id);
      else command.run();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [store, show]);

  return (
    <CommandContext value={context}>
      {children}
      <CommandPalette
        open={palette.open}
        session={palette.session}
        pageOf={palette.pageOf}
        close={close}
        showPage={show}
      />
    </CommandContext>
  );
}
