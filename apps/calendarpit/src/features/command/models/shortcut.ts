/**
 * A keyboard shortcut: `Mod+` and a key, such as `Mod+K` or `Mod+,`, or a
 * single key, such as `c` or `?`. `Mod` matches Command or Control, so the
 * same shortcut works on every platform.
 */
export type Shortcut = string;

/** The parts of a `KeyboardEvent` that shortcut matching reads. */
export type KeyPress = Pick<
  KeyboardEvent,
  | 'key'
  | 'metaKey'
  | 'ctrlKey'
  | 'altKey'
  | 'shiftKey'
  | 'repeat'
  | 'isComposing'
  | 'defaultPrevented'
>;

const modPrefix = 'Mod+';

/** Whether `shortcut` needs Command or Control, so it also works while typing. */
export const usesModifier = (shortcut: Shortcut) =>
  shortcut.startsWith(modPrefix);

const keyOf = (shortcut: Shortcut) =>
  usesModifier(shortcut) ? shortcut.slice(modPrefix.length) : shortcut;

/**
 * Whether `press` triggers `shortcut`.
 *
 * Presses during IME composition, key repeats, presses another handler
 * already took, and presses with Alt never match. A `Mod+` shortcut needs
 * exactly one of Command and Control and no Shift. A single-key shortcut
 * needs neither Command nor Control, and matches the produced character
 * exactly, so Shift+C (`C`) does not trigger `c` but Shift+/ triggers `?`.
 */
export function matchesShortcut(press: KeyPress, shortcut: Shortcut) {
  if (
    press.isComposing ||
    press.repeat ||
    press.defaultPrevented ||
    press.altKey
  )
    return false;
  const key = keyOf(shortcut);
  if (usesModifier(shortcut))
    return (
      press.metaKey !== press.ctrlKey &&
      !press.shiftKey &&
      press.key.toLowerCase() === key.toLowerCase()
    );
  return !press.metaKey && !press.ctrlKey && press.key === key;
}

/**
 * Returns the key caps to show for `shortcut`: `['⌘', 'K']` on macOS and
 * `['Ctrl', 'K']` elsewhere. Letters are shown in upper case.
 */
export function shortcutKeys(shortcut: Shortcut, mac: boolean) {
  const key = keyOf(shortcut).toUpperCase();
  return usesModifier(shortcut) ? [mac ? '⌘' : 'Ctrl', key] : [key];
}

/** Returns the `aria-keyshortcuts` value for `shortcut`. */
export function ariaKeyShortcuts(shortcut: Shortcut) {
  const key = keyOf(shortcut);
  return usesModifier(shortcut) ? `Meta+${key} Control+${key}` : key;
}
