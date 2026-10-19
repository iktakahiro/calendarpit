import { useIsMac } from '../hooks/use-commands';
import { shortcutKeys, type Shortcut } from '../models/shortcut';

/** Key caps for `shortcut`, with ⌘ on Apple platforms and Ctrl elsewhere. */
export function ShortcutKeys({ shortcut }: { shortcut: Shortcut }) {
  const mac = useIsMac();
  return (
    <span className='shortcut-keys'>
      {shortcutKeys(shortcut, mac).map((key) => (
        <kbd key={key}>{key}</kbd>
      ))}
    </span>
  );
}
