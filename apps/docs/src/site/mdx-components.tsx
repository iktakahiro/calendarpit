import defaultComponents from 'fumadocs-ui/mdx';
import { Tabs, Tab } from 'fumadocs-ui/components/tabs';
import { Steps, Step } from 'fumadocs-ui/components/steps';
import type { MDXComponents } from 'mdx/types';
import Link from 'fumadocs-core/link';
import { AdminScreen, AdminShowcase } from './admin-preview/admin-preview';

/**
 * Standard Fumadocs components and admin UI previews available to all English
 * and Japanese MDX.
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
} satisfies MDXComponents;
