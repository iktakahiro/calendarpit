import { Button } from '@cloudflare/kumo/components/button';
import { Icon } from '../../../components/icon';
import { useOpenPalette } from '../hooks/use-commands';
import { ariaKeyShortcuts } from '../models/shortcut';
import { ShortcutKeys } from './shortcut-keys';

/** Opens the command palette, and shows its shortcut. */
export function CommandButton() {
  const openPalette = useOpenPalette();
  return (
    <Button
      variant='secondary'
      icon={<Icon name='magnifier' />}
      aria-keyshortcuts={ariaKeyShortcuts('Mod+K')}
      onClick={() => openPalette()}
    >
      Commands
      <ShortcutKeys shortcut='Mod+K' />
    </Button>
  );
}
