import defaultComponents from 'fumadocs-ui/mdx';
import { Tabs, Tab } from 'fumadocs-ui/components/tabs';
import { Steps, Step } from 'fumadocs-ui/components/steps';
import type { MDXComponents } from 'mdx/types';
import Link from 'fumadocs-core/link';
import {
  Ban,
  CalendarDays,
  KeyRound,
  LayoutDashboard,
  RotateCcw,
  Webhook,
} from 'lucide-react';
import { AdminScreen, AdminShowcase } from './admin-preview/admin-preview';
import { DemoVideo } from './demo-video';

/**
 * Standard Fumadocs components, admin UI previews, and the icons that landing
 * cards pass to `<Card icon={...}>`, available to all English and Japanese MDX.
 */
export const mdxComponents = {
  ...defaultComponents,
  Tabs,
  Tab,
  Steps,
  Step,
  Link,
  AdminScreen,
  AdminShowcase,
  DemoVideo,
  Ban,
  CalendarDays,
  KeyRound,
  LayoutDashboard,
  RotateCcw,
  Webhook,
} satisfies MDXComponents;
