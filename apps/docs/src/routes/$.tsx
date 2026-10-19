import { createFileRoute, notFound } from '@tanstack/react-router';
import { Suspense, use } from 'react';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from 'fumadocs-ui/layouts/docs/page';
import { docs, source } from '../site/source';
import { mdxComponents } from '../site/mdx-components';
import { homeLayoutOptions, layoutOptions } from '../site/navigation';
import { groupSections } from '../site/navigation-tree';
import { markdownFile, sitePath } from '../site/paths';
import { i18n, localeFromPath } from '../site/i18n';
import { LandingHero } from '../site/landing-hero';
import { SiteFooter } from '../site/site-footer';
import { LandingMotionRoot } from '../site/motion/landing-motion';

/** Social preview image and Open Graph locale for each documentation language. */
const socialCards = {
  en: {
    image: 'og-image.png',
    locale: 'en_US',
    alt: 'Calendarpit: Google Calendar API on localhost',
  },
  ja: {
    image: 'og-image-ja.png',
    locale: 'ja_JP',
    alt: 'Calendarpit: ローカル環境で動く開発用 Google Calendar API',
  },
} as const;

/** Resolves every English/Japanese MDX page without a server function. */
export const Route = createFileRoute('/$')({
  loader: async ({ params }) => {
    const slug = (params._splat ?? '').replace(/\/$/u, '');
    const locale = localeFromPath(slug);
    const slugs = slug
      .split('/')
      .filter(Boolean)
      .slice(locale === i18n.defaultLanguage ? 0 : 1);
    const page = source.getPage(slugs, locale);
    if (!page) throw notFound();
    await page.data.preload();
    return {
      slug,
      locale,
      slugs,
      path: page.path,
      title: page.data.title,
      description: page.data.description,
      hero: page.data.hero,
    };
  },
  head: ({ loaderData: page }) => {
    if (!page) return {};
    const url = `${__DOCS_SITE_URL__}${sitePath(page.slug ? `${page.slug}/` : '')}`;
    const title = `${page.hero ? page.hero.title.replace(/\n/gu, ' ') : page.title} | Calendarpit`;
    const card = page.locale === 'ja' ? socialCards.ja : socialCards.en;
    return {
      meta: [
        { title },
        { name: 'description', content: page.description },
        { property: 'og:site_name', content: 'Calendarpit' },
        { property: 'og:title', content: title },
        { property: 'og:description', content: page.description },
        { property: 'og:type', content: 'website' },
        { property: 'og:url', content: url },
        { property: 'og:locale', content: card.locale },
        {
          property: 'og:image',
          content: `${__DOCS_SITE_URL__}${sitePath(card.image)}`,
        },
        { property: 'og:image:type', content: 'image/png' },
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '630' },
        { property: 'og:image:alt', content: card.alt },
        { name: 'twitter:card', content: 'summary_large_image' },
      ],
      links: [
        { rel: 'canonical', href: url },
        {
          rel: 'alternate',
          type: 'text/markdown',
          href: `${__DOCS_SITE_URL__}${sitePath(markdownFile(page.slug))}`,
        },
        ...i18n.languages.flatMap((locale) => {
          const alternate = source.getPage(page.slugs, locale);
          if (!alternate) return [];
          // Page URLs omit the trailing slash that every canonical URL carries.
          const href = `${__DOCS_SITE_URL__}${sitePath(`${alternate.url.replace(/\/$/u, '')}/`)}`;
          return [
            { rel: 'alternate', hrefLang: locale, href },
            ...(locale === i18n.defaultLanguage
              ? [{ rel: 'alternate', hrefLang: 'x-default', href }]
              : []),
          ];
        }),
      ],
    };
  },
  component: Page,
});

function Content() {
  const page = Route.useLoaderData();
  const content = docs.getPage(page.path);
  if (!content) throw notFound();
  const { toc } = use(content.load());
  const MDX = content.body;
  const japanese = page.locale === 'ja';
  if (page.hero)
    return (
      <HomeLayout {...homeLayoutOptions(page.slug)}>
        <LandingMotionRoot>
          <LandingHero page={page} />
          <DocsBody className='landing-body'>
            <MDX components={mdxComponents} />
          </DocsBody>
          <SiteFooter japanese={japanese} />
        </LandingMotionRoot>
      </HomeLayout>
    );
  return (
    <DocsLayout
      {...layoutOptions(page.slug)}
      tree={groupSections(source.getPageTree(page.locale))}
    >
      <DocsPage toc={toc} id='main-content'>
        <DocsTitle>{page.title}</DocsTitle>
        <DocsDescription className='page-description'>
          {page.description}
        </DocsDescription>
        <DocsBody>
          <MDX components={mdxComponents} />
        </DocsBody>
      </DocsPage>
    </DocsLayout>
  );
}

function Page() {
  return (
    <Suspense>
      <Content />
    </Suspense>
  );
}
