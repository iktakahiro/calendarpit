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

/** Labelled groups of the sidebar navigation. */
export type SectionGroupId = 'activity' | 'workspace';

/** A labelled group of sections in the sidebar navigation. */
export type SectionGroup = {
  id: SectionGroupId;
  label: string;
};

/**
 * Navigation groups in order. Activity is what the app under test did;
 * workspace is the test data and configuration it runs against.
 */
export const sectionGroups: SectionGroup[] = [
  { id: 'activity', label: 'Activity' },
  { id: 'workspace', label: 'Workspace' },
];

/** Navigation and header text for one section. */
export type Section = {
  id: SectionId;
  label: string;
  icon: IconName;
  /** Navigation group. Omitted for the primary screen, listed first. */
  group?: SectionGroupId;
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
    id: 'history',
    label: 'API history',
    icon: 'code',
    group: 'activity',
    eyebrow: 'Protocol log',
    lede: 'Calendar and OAuth requests from your app, with headers and bodies.',
  },
  {
    id: 'watch',
    label: 'Watch',
    icon: 'broadcast',
    group: 'activity',
    eyebrow: 'Notifications',
    lede: 'Inspect active subscriptions and webhook deliveries from all calendars.',
  },
  {
    id: 'connections',
    label: 'Connections',
    icon: 'plug',
    group: 'activity',
    eyebrow: 'Integration',
    lede: 'Review permissions and revoke connections to test reconnection.',
  },
  {
    id: 'users',
    label: 'Users',
    icon: 'persons',
    group: 'workspace',
    eyebrow: 'Directory',
    lede: 'Create and edit local test identities. No login or password required.',
  },
  {
    id: 'calendars',
    label: 'Calendars',
    icon: 'calendar',
    group: 'workspace',
    eyebrow: 'Directory',
    lede: 'Manage calendars for the selected test user.',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: 'gear',
    group: 'workspace',
    eyebrow: 'Configuration',
    lede: 'Set your appearance and configure the local test workspace.',
  },
];

/** Returns a section's metadata. */
export const sectionOf = (id: SectionId) =>
  sections.find((section) => section.id === id)!;
