import type { IconName } from '../../../components/icon';
import type { Shortcut } from './shortcut';

/** Groups of the command palette. */
export type CommandGroupId = 'schedule' | 'navigate' | 'switch' | 'workspace';

/** Group labels in the order the palette lists them when nothing is typed. */
export const commandGroups: { id: CommandGroupId; label: string }[] = [
  { id: 'schedule', label: 'Schedule' },
  { id: 'navigate', label: 'Go to' },
  { id: 'switch', label: 'Switch' },
  { id: 'workspace', label: 'Workspace' },
];

/**
 * A second palette page that a command opens, such as a list of users or a
 * date prompt.
 */
export type CommandPage = {
  /** Group label above the page's results. */
  title: string;
  placeholder: string;
  /** Text shown when no command matches. */
  empty: string;
  /** Returns the page's commands for the typed `query`. */
  commands: (query: string) => Command[];
  /**
   * Whether `commands` already answers `query`, as a date prompt does. The
   * palette otherwise filters the commands by the query itself.
   */
  answersQuery?: boolean;
  /** Whether a search on the first page also lists this page's commands. */
  searchable?: boolean;
};

/**
 * An action of the admin UI. The palette lists it, and its `shortcut`, if
 * any, runs it from the keyboard, so both always agree.
 */
export type Command = {
  /** Unique among registered commands. */
  id: string;
  label: string;
  group: CommandGroupId;
  /** Secondary text, such as an email or a time zone. */
  description?: string;
  /** Extra search terms that are not shown. */
  keywords?: string[];
  icon?: IconName;
  shortcut?: Shortcut;
  disabled?: boolean;
  /** Marks the current choice, such as the selected user or the shown view. */
  current?: boolean;
} & ({ run: () => void; page?: never } | { page: CommandPage; run?: never });

/**
 * Commands of one group, in the order the palette shows them. The list is
 * named `items` because the palette's Base UI autocomplete recognizes groups
 * by an `items` array, and moves the highlight through them by it.
 */
export type CommandResultGroup = {
  id: string;
  label: string;
  items: Command[];
};

const words = (text: string) => text.toLowerCase().split(/\s+/).filter(Boolean);

/**
 * Scores how well `command` matches the query `terms`: 0 when a term is
 * missing, 3 when the label starts with the query, 2 when a label word starts
 * with the first term, and 1 for any other match. An empty query scores 1.
 */
function score(command: Command, terms: string[]) {
  if (!terms.length) return 1;
  const label = command.label.toLowerCase();
  const text = [label, command.description ?? '', ...(command.keywords ?? [])]
    .join(' ')
    .toLowerCase();
  if (!terms.every((term) => text.includes(term))) return 0;
  if (label.startsWith(terms.join(' '))) return 3;
  return words(label).some((word) => word.startsWith(terms[0]!)) ? 2 : 1;
}

/** Returns the commands matching `query`, best match first, keeping ties in order. */
function rank(commands: Command[], query: string) {
  const terms = words(query);
  return commands
    .map((command, index) => ({ command, index, score: score(command, terms) }))
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index);
}

/**
 * Returns the first palette page's results for `query`, grouped.
 *
 * With a query, the commands of searchable pages are listed too, so typing a
 * user's name finds that user without opening the user list first. Groups
 * follow `commandGroups` order when nothing is typed, and otherwise their
 * best match.
 */
export function searchCommands(
  commands: Command[],
  query: string,
): CommandResultGroup[] {
  const nested = query.trim()
    ? commands.flatMap((command) =>
        command.page?.searchable && !command.disabled
          ? command.page.commands('')
          : [],
      )
    : [];
  const matches = rank([...commands, ...nested], query);
  return commandGroups
    .map((group, order) => {
      const inGroup = matches.filter((m) => m.command.group === group.id);
      return {
        group: {
          id: group.id,
          label: group.label,
          items: inGroup.map((m) => m.command),
        },
        order,
        best: inGroup[0]?.score ?? 0,
      };
    })
    .filter((entry) => entry.group.items.length)
    .sort((a, b) => (query.trim() ? b.best - a.best : 0) || a.order - b.order)
    .map((entry) => entry.group);
}

/** Returns the results of `page` for `query` as one group titled after the page. */
export function searchPage(
  page: CommandPage,
  query: string,
): CommandResultGroup[] {
  const commands = page.answersQuery
    ? page.commands(query)
    : rank(page.commands(query), query).map((match) => match.command);
  return commands.length
    ? [{ id: 'page', label: page.title, items: commands }]
    : [];
}
