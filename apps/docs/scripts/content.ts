import { getSlugs } from 'fumadocs-core/source';
import { i18n, localeFromPath } from '../src/site/i18n';

/** Enumerates static routes and rejects missing configured translations. */
export async function readPages(
  directory: string,
): Promise<{ slug: string }[]> {
  const pages: { slug: string }[] = [];
  for await (const file of new Bun.Glob('**/*.mdx').scan(directory)) {
    pages.push({ slug: getSlugs(file).join('/') });
  }
  for (const page of pages) {
    const locale = localeFromPath(page.slug);
    const slugs = page.slug
      .split('/')
      .filter(Boolean)
      .slice(locale === i18n.defaultLanguage ? 0 : 1);
    for (const language of i18n.languages) {
      const counterpart = [
        ...(language === i18n.defaultLanguage ? [] : [language]),
        ...slugs,
      ].join('/');
      if (!pages.some((candidate) => candidate.slug === counterpart)) {
        throw new Error(`Missing ${language} translation for ${page.slug}`);
      }
    }
  }
  return pages.sort((left, right) => left.slug.localeCompare(right.slug));
}
