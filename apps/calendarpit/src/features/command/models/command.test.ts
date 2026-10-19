import { describe, expect, test } from 'bun:test';
import {
  searchCommands,
  searchPage,
  type Command,
  type CommandPage,
} from './command';

const run = () => {};

const users: CommandPage = {
  title: 'Users',
  placeholder: 'Search test users…',
  empty: 'No matching users.',
  searchable: true,
  commands: () => [
    {
      id: 'user.alex',
      label: 'Alex Morgan',
      description: 'alex@example.com',
      group: 'switch',
      run,
    },
    {
      id: 'user.sam',
      label: 'Sam Lee',
      description: 'sam@example.com',
      group: 'switch',
      run,
    },
  ],
};

const commands: Command[] = [
  { id: 'theme.dark', label: 'Theme: Dark', group: 'workspace', run },
  { id: 'event.new', label: 'New event', group: 'schedule', run },
  {
    id: 'go.users',
    label: 'Users',
    group: 'navigate',
    keywords: ['directory'],
    run,
  },
  {
    id: 'go.history',
    label: 'API history',
    group: 'navigate',
    keywords: ['requests'],
    run,
  },
  { id: 'switch.user', label: 'Switch user…', group: 'switch', page: users },
];

const ids = (groups: ReturnType<typeof searchCommands>) =>
  groups.map((group) => [group.id, group.items.map((c) => c.id)]);

describe('searchCommands', () => {
  test('lists every command in group order when nothing is typed', () => {
    expect(ids(searchCommands(commands, ''))).toEqual([
      ['schedule', ['event.new']],
      ['navigate', ['go.users', 'go.history']],
      ['switch', ['switch.user']],
      ['workspace', ['theme.dark']],
    ]);
  });

  test('matches labels, keywords, and descriptions without case', () => {
    expect(ids(searchCommands(commands, 'REQUESTS'))).toEqual([
      ['navigate', ['go.history']],
    ]);
  });

  test('needs every typed word to match', () => {
    expect(ids(searchCommands(commands, 'new event'))).toEqual([
      ['schedule', ['event.new']],
    ]);
    expect(searchCommands(commands, 'new user')).toEqual([]);
  });

  test('lists searchable page commands once something is typed', () => {
    expect(ids(searchCommands(commands, 'sam'))).toEqual([
      ['switch', ['user.sam']],
    ]);
    expect(ids(searchCommands(commands, 'example.com'))).toEqual([
      ['switch', ['user.alex', 'user.sam']],
    ]);
  });

  test('puts the group with the best match first', () => {
    // "Users" starts with the query; "Switch user…" only contains it.
    expect(ids(searchCommands(commands, 'user'))).toEqual([
      ['navigate', ['go.users']],
      ['switch', ['switch.user']],
    ]);
  });

  test('skips the pages of disabled commands', () => {
    const disabled = commands.map((c) =>
      c.id === 'switch.user' ? { ...c, disabled: true } : c,
    );
    expect(searchCommands(disabled, 'sam')).toEqual([]);
  });
});

describe('searchPage', () => {
  test('filters a page by the query under the page title', () => {
    expect(ids(searchPage(users, 'lee'))).toEqual([['page', ['user.sam']]]);
  });

  test('uses the commands as is when the page answers the query', () => {
    const page: CommandPage = {
      ...users,
      answersQuery: true,
      commands: (query) =>
        query ? [{ id: query, label: 'Anything', group: 'schedule', run }] : [],
    };
    expect(ids(searchPage(page, '+3'))).toEqual([['page', ['+3']]]);
    expect(searchPage(page, '')).toEqual([]);
  });
});
