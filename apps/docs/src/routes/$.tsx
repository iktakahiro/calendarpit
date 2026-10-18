import { createFileRoute, notFound } from '@tanstack/react-router';
import { Suspense, use } from 'react';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
  EditOnGitHub,
} from 'fumadocs-ui/layouts/docs/page';
import { docs, source } from '../site/source';
import { mdxComponents } from '../site/mdx-components';
import { layoutOptions } from '../site/navigation';
import { sitePath } from '../site/paths';
import { i18n, localeFromPath } from '../site/i18n';
import { LandingHero } from '../site/landing-hero';

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
    return {
      meta: [
        { title },
        { name: 'description', content: page.description },
        { property: 'og:title', content: title },
        { property: 'og:description', content: page.description },
        { property: 'og:type', content: 'website' },
        { property: 'og:url', content: url },
      ],
      links: [
        { rel: 'canonical', href: url },
        ...i18n.languages.flatMap((locale) => {
          const alternate = source.getPage(page.slugs, locale);
          return alternate
            ? [
                {
                  rel: 'alternate',
                  hrefLang: locale,
                  href: `${__DOCS_SITE_URL__}${sitePath(alternate.url)}`,
                },
              ]
            : [];
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
      <HomeLayout {...layoutOptions(page.slug)}>
        <main id='main-content' className='landing'>
          <LandingHero page={page} />
          <DocsBody className='landing-body'>
            <MDX components={mdxComponents} />
          </DocsBody>
          <footer className='site-footer'>
            Calendarpit{' '}
            <span>
              {japanese
                ? 'ローカル開発と、繰り返せるテストのために。'
                : 'Built for local development. Ready to repeat.'}
            </span>
          </footer>
        </main>
      </HomeLayout>
    );
  return (
    <DocsLayout
      {...layoutOptions(page.slug)}
      tree={source.getPageTree(page.locale)}
    >
      <DocsPage toc={toc} id='main-content'>
        <DocsTitle>{page.title}</DocsTitle>
        <DocsDescription>{page.description}</DocsDescription>
        <DocsBody>
          <MDX components={mdxComponents} />
        </DocsBody>
        <EditOnGitHub
          href={`https://github.com/iktakahiro/calendarpit/edit/main/apps/docs/src/content/docs/${page.slug}.mdx`}
        >
          {japanese ? 'GitHub でこのページを編集' : 'Edit this page on GitHub'}{' '}
          ↗
        </EditOnGitHub>
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
