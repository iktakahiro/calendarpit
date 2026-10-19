import { defineDocs } from 'fumadocs-mdx/macro';
import { loader } from 'fumadocs-core/source';
import { pageSchema } from 'fumadocs-core/source/schema';
import { z } from 'zod';
import { i18n } from './i18n';
import { navigationIcon } from './navigation-icons';

/** Validated, lazily compiled MDX using the official Fumadocs content source. */
export const docs = defineDocs({
  dir: 'src/content/docs',
  docs: {
    async: true,
    schema: pageSchema.extend({
      description: z.string().min(1),
      hero: z.object({ title: z.string(), tagline: z.string() }).optional(),
    }),
  },
});

/** Localized pages and navigation generated from MDX and meta.json files. */
export const source = loader({
  baseUrl: '/',
  source: docs.toFumadocsSource(),
  i18n,
  icon: navigationIcon,
  url: (slugs, locale) => {
    const parts = [
      ...(locale && locale !== i18n.defaultLanguage ? [locale] : []),
      ...slugs,
    ];
    return parts.length ? `/${parts.join('/')}/` : '/';
  },
});

/** Serializable page metadata passed from the route loader to the renderer. */
export type PageMetadata = Pick<
  (typeof docs.docs)[number],
  'title' | 'description' | 'hero'
> & { slug: string };
