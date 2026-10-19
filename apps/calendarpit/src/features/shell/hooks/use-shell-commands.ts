import type { Snapshot } from '@calendarpit/server';
import { useAppearance } from '../../../components/appearance';
import type { Appearance } from '../../../lib/appearance';
import { messages } from '../../../lib/messages';
import { useRegisterCommands } from '../../command/hooks/use-commands';
import type { Command } from '../../command/models/command';
import type { Selection } from '../../workspace/models/selection';
import { sections, type SectionId } from '../models/sections';

const appearances: { mode: Appearance; label: string }[] = [
  { mode: 'light', label: 'Light' },
  { mode: 'dark', label: 'Dark' },
  { mode: 'system', label: 'System' },
];

/**
 * Registers the commands available on every screen: a new event, the
 * sections, the user and calendar switchers, refresh, and the theme.
 *
 * The palette is English-only. Section commands also match their Japanese
 * labels, so the sidebar's words find them in either language.
 */
export function useShellCommands({
  snapshot,
  selection,
  section,
  busy,
  openSection,
  selectUser,
  selectCalendar,
  createEvent,
  refresh,
}: {
  snapshot?: Snapshot;
  selection: Selection;
  section: SectionId;
  busy: boolean;
  openSection: (section: SectionId) => void;
  selectUser: (userId: string) => void;
  selectCalendar: (calendarId: string, showSchedule: boolean) => void;
  createEvent: () => void;
  refresh: () => void;
}) {
  const { preference, setPreference } = useAppearance();
  const { user, calendars, calendar } = selection;
  const users = snapshot?.users ?? [];
  const commands: Command[] = [
    {
      id: 'event.new',
      label: 'New event',
      group: 'schedule',
      icon: 'plus',
      keywords: ['create', 'add'],
      shortcut: 'c',
      disabled: !calendar,
      run: createEvent,
    },
    ...sections.map((s): Command => ({
      id: `go.${s.id}`,
      label: messages.en[s.label],
      group: 'navigate',
      icon: s.icon,
      keywords: [
        messages.en[s.eyebrow],
        messages.ja[s.label],
        messages.ja[s.eyebrow],
      ],
      shortcut: s.id === 'settings' ? 'Mod+,' : undefined,
      current: s.id === section,
      run: () => openSection(s.id),
    })),
    {
      id: 'switch.user',
      label: 'Switch user…',
      group: 'switch',
      icon: 'persons',
      keywords: ['test user'],
      disabled: users.length < 2,
      page: {
        title: 'Test users',
        placeholder: 'Search test users…',
        empty: 'No matching test users.',
        searchable: true,
        commands: () =>
          users.map((u) => ({
            id: `user.${u.id}`,
            label: u.name,
            description: u.email,
            group: 'switch',
            icon: 'persons',
            keywords: ['user'],
            current: u.id === user?.id,
            run: () => selectUser(u.id),
          })),
      },
    },
    {
      id: 'switch.calendar',
      label: 'Switch calendar…',
      group: 'switch',
      icon: 'calendar',
      disabled: calendars.length < 2,
      page: {
        title: user ? `Calendars of ${user.name}` : 'Calendars',
        placeholder: 'Search calendars…',
        empty: 'No matching calendars.',
        searchable: true,
        commands: () =>
          calendars.map((c) => ({
            id: `calendar.${c.id}`,
            label: c.summary,
            description: c.timeZone,
            group: 'switch',
            icon: 'calendar',
            keywords: ['calendar', c.id],
            current: c.id === calendar?.id,
            run: () => selectCalendar(c.id, false),
          })),
      },
    },
    {
      id: 'workspace.refresh',
      label: 'Refresh workspace',
      group: 'workspace',
      icon: 'arrowRotateRight',
      keywords: ['reload'],
      disabled: busy,
      run: refresh,
    },
    ...appearances.map(({ mode, label }): Command => ({
      id: `theme.${mode}`,
      label: `Theme: ${label}`,
      group: 'workspace',
      icon: mode === 'light' ? 'sun' : mode === 'dark' ? 'moon' : 'display',
      keywords: ['appearance', 'mode'],
      current: preference === mode,
      run: () => setPreference(mode),
    })),
  ];
  useRegisterCommands(commands);
}
