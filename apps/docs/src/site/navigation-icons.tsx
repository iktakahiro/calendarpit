import {
  BookOpen,
  CalendarDays,
  Download,
  FlaskConical,
  LifeBuoy,
  Plug,
  Rocket,
  SquareTerminal,
} from 'lucide-react';

const icons = {
  BookOpen,
  CalendarDays,
  Download,
  FlaskConical,
  LifeBuoy,
  Plug,
  Rocket,
  SquareTerminal,
};

function isIconName(name: string): name is keyof typeof icons {
  return Object.hasOwn(icons, name);
}

/**
 * Resolves a sidebar icon named in page frontmatter (`icon: Rocket`) or in a
 * `meta.json` separator (`---[Plug]Connect your app---`).
 *
 * @throws Error when the name is not in the allowlist, so a typo fails the
 * build instead of rendering an empty slot.
 */
export function navigationIcon(name: string | undefined) {
  if (name === undefined) return undefined;
  if (!isIconName(name)) throw new Error(`Unknown sidebar icon: ${name}`);
  const Icon = icons[name];
  return <Icon />;
}
