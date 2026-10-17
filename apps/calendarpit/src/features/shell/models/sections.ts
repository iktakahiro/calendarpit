import type { IconName } from '../../../components/icon';

/** Top-level sections of the admin UI, each with its own route. */
export type SectionId =
  | 'schedule'
  | 'users'
  | 'calendars'
  | 'connections'
  | 'watch'
  | 'history'
  | 'settings';

/** Navigation and header text for one section. */
export type Section = {
  id: SectionId;
  label: string;
  icon: IconName;
  eyebrow: string;
  /** Header text. The schedule builds its own from the selection. */
  lede: string;
};

/** Sections in navigation order. */
export const sections: Section[] = [
  {
    id: 'schedule',
    label: 'Schedule',
    icon: 'calendar',
    eyebrow: 'Schedule',
    lede: '',
  },
  {
    id: 'users',
    label: 'Users',
    icon: 'persons',
    eyebrow: 'Directory',
    lede: 'Create and edit local test identities. No login or password required.',
  },
  {
    id: 'calendars',
    label: 'Calendars',
    icon: 'calendar',
    eyebrow: 'Directory',
    lede: 'Manage calendars for the selected test user.',
  },
  {
    id: 'connections',
    label: 'Connections',
    icon: 'plug',
    eyebrow: 'Integration',
    lede: 'Review permissions and revoke connections to test reconnection.',
  },
  {
    id: 'watch',
    label: 'Watch',
    icon: 'broadcast',
    eyebrow: 'Notifications',
    lede: 'Inspect active subscriptions and webhook deliveries from all calendars.',
  },
  {
    id: 'history',
    label: 'API history',
    icon: 'code',
    eyebrow: 'Protocol log',
    lede: 'Calendar and OAuth requests from your app, with headers and bodies.',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: 'gear',
    eyebrow: 'Configuration',
    lede: 'Set your appearance and configure the local test workspace.',
  },
];

/** Returns a section's metadata. */
export const sectionOf = (id: SectionId) =>
  sections.find((section) => section.id === id)!;
