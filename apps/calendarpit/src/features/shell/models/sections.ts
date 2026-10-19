import type { IconName } from '../../../components/icon';
import type { TextKey } from '../../../lib/messages';

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
  label: TextKey;
};

/**
 * Navigation groups in order. Activity is what the app under test did;
 * workspace is the test data and configuration it runs against.
 */
export const sectionGroups: SectionGroup[] = [
  { id: 'activity', label: 'group.activity' },
  { id: 'workspace', label: 'group.workspace' },
];

/**
 * Navigation and header text for one section. Text fields are message keys,
 * so the sidebar and header follow the interface language.
 */
export type Section = {
  id: SectionId;
  label: TextKey;
  icon: IconName;
  /** Navigation group. Omitted for the primary screen, listed first. */
  group?: SectionGroupId;
  eyebrow: TextKey;
  /** Header text. Omitted for the schedule, which builds its own. */
  lede?: TextKey;
};

/** Sections in navigation order. */
export const sections: Section[] = [
  {
    id: 'schedule',
    label: 'section.schedule.label',
    icon: 'calendar',
    eyebrow: 'section.schedule.eyebrow',
  },
  {
    id: 'history',
    label: 'section.history.label',
    icon: 'code',
    group: 'activity',
    eyebrow: 'section.history.eyebrow',
    lede: 'section.history.lede',
  },
  {
    id: 'watch',
    label: 'section.watch.label',
    icon: 'broadcast',
    group: 'activity',
    eyebrow: 'section.watch.eyebrow',
    lede: 'section.watch.lede',
  },
  {
    id: 'connections',
    label: 'section.connections.label',
    icon: 'plug',
    group: 'activity',
    eyebrow: 'section.connections.eyebrow',
    lede: 'section.connections.lede',
  },
  {
    id: 'users',
    label: 'section.users.label',
    icon: 'persons',
    group: 'workspace',
    eyebrow: 'section.users.eyebrow',
    lede: 'section.users.lede',
  },
  {
    id: 'calendars',
    label: 'section.calendars.label',
    icon: 'calendar',
    group: 'workspace',
    eyebrow: 'section.calendars.eyebrow',
    lede: 'section.calendars.lede',
  },
  {
    id: 'settings',
    label: 'section.settings.label',
    icon: 'gear',
    group: 'workspace',
    eyebrow: 'section.settings.eyebrow',
    lede: 'section.settings.lede',
  },
];

/** Returns a section's metadata. */
export const sectionOf = (id: SectionId) =>
  sections.find((section) => section.id === id)!;
