import { CommandPalette as Palette } from '@cloudflare/kumo/components/command-palette';
import { useState } from 'react';
import { Icon } from '../../../components/icon';
import { useCommands } from '../hooks/use-commands';
import {
  searchCommands,
  searchPage,
  type Command,
  type CommandResultGroup,
} from '../models/command';
import { ShortcutKeys } from './shortcut-keys';

/**
 * The command palette dialog. The first page searches every registered
 * command; a command with a `page` opens that page in the same dialog.
 */
export function CommandPalette({
  open,
  session,
  pageOf,
  close,
  showPage,
}: {
  open: boolean;
  /** Changes on every opening, which resets the query. */
  session: number;
  /** ID of the command whose page is shown, or the first page. */
  pageOf?: string;
  close: () => void;
  showPage: (pageOf?: string) => void;
}) {
  const commands = useCommands();
  const pageCommand = commands.find((c) => c.id === pageOf && c.page);
  return (
    <Palette.Dialog open={open} onOpenChange={(next) => next || close()}>
      <PalettePanel
        // A new opening or page starts with an empty query and the first result highlighted.
        key={`${session}:${pageCommand?.id ?? ''}`}
        commands={commands}
        page={pageCommand}
        run={(command) => {
          if (command.disabled) return;
          if (command.page) return showPage(command.id);
          close();
          // Run after the dialog returns focus, so a command can move it.
          requestAnimationFrame(command.run);
        }}
        back={() => showPage(undefined)}
      />
    </Palette.Dialog>
  );
}

function PalettePanel({
  commands,
  page,
  run,
  back,
}: {
  commands: Command[];
  /** The command whose page is shown, or `undefined` for the first page. */
  page?: Command;
  run: (command: Command) => void;
  back: () => void;
}) {
  const [query, setQuery] = useState('');
  const groups: CommandResultGroup[] = page?.page
    ? searchPage(page.page, query)
    : searchCommands(commands, query);
  return (
    <Palette.Panel
      items={groups}
      value={query}
      onValueChange={setQuery}
      itemToStringValue={(item) => item.label}
      getSelectableItems={(items) => items.flatMap((group) => group.items)}
    >
      <Palette.Input
        aria-label={page?.page ? page.page.title : 'Search commands'}
        placeholder={
          page?.page?.placeholder ?? 'Search commands, users, and calendars…'
        }
        className='palette-input'
        autoComplete='off'
        autoCorrect='off'
        autoCapitalize='none'
        spellCheck={false}
        data-1p-ignore='true'
        data-lpignore='true'
        leading={
          page ? (
            <button
              type='button'
              className='palette-back'
              aria-label='Back to all commands'
              onClick={back}
            >
              <Icon name='chevronLeft' />
            </button>
          ) : undefined
        }
        onKeyDown={(event) => {
          if (page && event.key === 'Backspace' && !query) {
            event.preventDefault();
            back();
          }
        }}
      />
      <Palette.List>
        <Palette.Results>
          {(group: CommandResultGroup) => (
            <Palette.Group key={group.id} items={group.items}>
              <Palette.GroupLabel>{group.label}</Palette.GroupLabel>
              <Palette.Items>
                {(command: Command) => (
                  <Palette.Item
                    key={command.id}
                    value={command}
                    disabled={command.disabled}
                    onClick={() => run(command)}
                  >
                    <CommandRow command={command} />
                  </Palette.Item>
                )}
              </Palette.Items>
            </Palette.Group>
          )}
        </Palette.Results>
        <Palette.Empty>
          {page?.page?.empty ?? 'No matching commands.'}
        </Palette.Empty>
      </Palette.List>
      <Palette.Footer>
        <span className='palette-hints'>
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> Move
          </span>
          <span>
            <kbd>↵</kbd> {page ? 'Choose' : 'Run'}
          </span>
          {page && (
            <span>
              <kbd>⌫</kbd> Back
            </span>
          )}
          <span>
            <kbd>Esc</kbd> Close
          </span>
        </span>
      </Palette.Footer>
    </Palette.Panel>
  );
}

function CommandRow({ command }: { command: Command }) {
  return (
    <span className='command-row'>
      <Icon name={command.icon ?? 'chevronRight'} />
      <span className='command-label'>
        {command.label}
        {command.description && <small>{command.description}</small>}
      </span>
      {command.current && <span className='command-current'>Current</span>}
      {command.shortcut && <ShortcutKeys shortcut={command.shortcut} />}
      {command.page && <Icon name='chevronRight' className='command-more' />}
    </span>
  );
}
