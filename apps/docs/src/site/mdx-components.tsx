import defaultComponents from 'fumadocs-ui/mdx';
import { Tabs, Tab } from 'fumadocs-ui/components/tabs';
import { Steps, Step } from 'fumadocs-ui/components/steps';
import type { MDXComponents } from 'mdx/types';
import Link from 'fumadocs-core/link';

/** Standard Fumadocs components available to all English and Japanese MDX. */
export const mdxComponents = {
  ...defaultComponents,
  Tabs,
  Tab,
  Steps,
  Step,
  Link,
} satisfies MDXComponents;
