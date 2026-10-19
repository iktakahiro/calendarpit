/** Resolves an unprefixed site path against the configured deployment base. */
export function sitePath(path = ''): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//u, '')}`;
}

/**
 * Names the Markdown file published beside a page, relative to the site base.
 * A page slug gains `.md` (`quick-start` → `quick-start.md`, `ja` → `ja.md`),
 * and the root page is `index.md`.
 */
export function markdownFile(slug: string): string {
  return slug ? `${slug}.md` : 'index.md';
}
