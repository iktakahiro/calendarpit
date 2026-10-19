import { resolve } from 'node:path';
import { readPages } from './content';
import { i18n, localeFromPath } from '../src/site/i18n';
import { markdownFile } from '../src/site/paths';

const root = resolve(import.meta.dirname, '..');
const base = process.env.DOCS_BASE_PATH ?? '/';
const origin = new URL(process.env.DOCS_SITE_URL ?? 'https://calendarpit.dev')
  .origin;
const pages = await readPages(`${root}/src/content/docs`);
const errors: string[] = [];
const documents = new Map<
  string,
  { ids: Set<string>; links: string[]; alternates: string[] }
>();

for await (const file of new Bun.Glob('**/*.html').scan(`${root}/dist`)) {
  const html = await Bun.file(`${root}/dist/${file}`).text();
  const ids = new Set<string>();
  const links: string[] = [];
  let language = '';
  let title = '';
  let headings = 0;
  let canonical = '';
  let image = '';
  let card = '';
  const alternates: string[] = [];
  const assets: string[] = [];
  await new HTMLRewriter()
    .on('[id]', {
      element(element) {
        const id = element.getAttribute('id');
        if (id) ids.add(id);
      },
    })
    .on('a[href]', {
      element(element) {
        links.push(element.getAttribute('href') ?? '');
      },
    })
    .on('html', {
      element(element) {
        language = element.getAttribute('lang') ?? '';
      },
    })
    .on('title', {
      text(chunk) {
        title += chunk.text;
      },
    })
    .on('h1', {
      element() {
        headings++;
      },
    })
    .on('link[rel="canonical"]', {
      element(element) {
        canonical = element.getAttribute('href') ?? '';
      },
    })
    .on('meta[property="og:image"]', {
      element(element) {
        image = element.getAttribute('content') ?? '';
      },
    })
    .on('meta[name="twitter:card"]', {
      element(element) {
        card = element.getAttribute('content') ?? '';
      },
    })
    .on('link[rel="alternate"][hreflang]', {
      element(element) {
        alternates.push(element.getAttribute('href') ?? '');
      },
    })
    .on('script[src], link[rel="stylesheet"], img[src]', {
      element(element) {
        assets.push(
          element.getAttribute('src') ?? element.getAttribute('href') ?? '',
        );
      },
    })
    .transform(new Response(html))
    .text();
  const pathname = `${base}${file === 'index.html' ? '' : file.replace(/index\.html$/u, '')}`;
  documents.set(pathname, { ids, links, alternates });
  if (language !== localeFromPath(file))
    errors.push(`${file}: incorrect html lang (${language})`);
  if (!title || headings !== 1)
    errors.push(
      `${file}: missing title or expected one rendered h1, got ${headings}`,
    );
  if (file !== '404.html' && canonical !== `${origin}${pathname}`)
    errors.push(`${file}: incorrect canonical URL (${canonical})`);
  // Social previews need an absolute image URL; crawlers do not resolve paths.
  if (file !== '404.html') {
    if (!image.startsWith(`${origin}${base}`)) {
      errors.push(`${file}: missing absolute og:image (${image})`);
    } else if (
      !(await Bun.file(
        `${root}/dist/${new URL(image).pathname.slice(base.length)}`,
      ).exists())
    ) {
      errors.push(`${file}: missing og:image file ${image}`);
    }
    if (card !== 'summary_large_image')
      errors.push(`${file}: unexpected twitter:card (${card})`);
  }
  if (html.includes('/api/search') || html.includes('/_serverFn/'))
    errors.push(`${file}: runtime API dependency`);
  for (const href of assets) {
    if (/^https?:/u.test(href)) {
      if (new URL(href).hostname !== 'fonts.googleapis.com')
        errors.push(`${file}: unexpected remote asset ${href}`);
      continue;
    }
    const url = new URL(href, `${origin}${pathname}`);
    const relative = decodeURIComponent(url.pathname.slice(base.length));
    if (
      !url.pathname.startsWith(base) ||
      !(await Bun.file(`${root}/dist/${relative}`).exists())
    )
      errors.push(`${file}: missing asset ${href}`);
  }
}
for (const [pathname, { links, alternates }] of documents) {
  // Language alternates must name the canonical URL, not one that redirects.
  for (const href of alternates) {
    const target = new URL(href);
    if (target.origin !== origin || !documents.has(target.pathname))
      errors.push(`${pathname}: hreflang is not a canonical page ${href}`);
  }
  for (const href of links) {
    const target = new URL(href, `${origin}${pathname}`);
    if (target.origin !== origin) continue;
    const destination = documents.get(target.pathname);
    if (!destination) {
      if (
        !target.pathname.startsWith(base) ||
        !(await Bun.file(
          `${root}/dist/${decodeURIComponent(target.pathname.slice(base.length))}`,
        ).exists())
      )
        errors.push(`${pathname}: broken link ${href}`);
    } else if (
      target.hash &&
      !destination.ids.has(decodeURIComponent(target.hash.slice(1)))
    ) {
      errors.push(`${pathname}: broken anchor ${href}`);
    }
  }
}
for (const page of pages) {
  if (!documents.has(`${base}${page.slug ? `${page.slug}/` : ''}`))
    errors.push(`Missing generated page: ${page.slug}`);
}
// Agent-readable text must cover every page and link only to published files.
const texts = i18n.languages.flatMap((locale) => {
  const prefix = locale === i18n.defaultLanguage ? '' : `${locale}/`;
  return [`${prefix}llms.txt`, `${prefix}llms-full.txt`];
});
for (const page of pages) texts.push(markdownFile(page.slug));
for (const file of texts) {
  const text = Bun.file(`${root}/dist/${file}`);
  if (!(await text.exists())) {
    errors.push(`Missing agent-readable text: ${file}`);
    continue;
  }
  for (const [, href = ''] of (await text.text()).matchAll(
    /\]\((https?:\/\/[^)\s]+)\)/gu,
  )) {
    const target = new URL(href);
    if (target.origin !== origin || documents.has(target.pathname)) continue;
    if (
      !target.pathname.startsWith(base) ||
      !(await Bun.file(
        `${root}/dist/${decodeURIComponent(target.pathname.slice(base.length))}`,
      ).exists())
    )
      errors.push(`${file}: broken link ${href}`);
  }
}
if (documents.size !== pages.length + 1)
  errors.push('Unexpected number of generated HTML pages.');
if (await Bun.file(`${root}/dist/server/server.js`).exists())
  errors.push('Server bundle must not be published.');

// Translations must preserve executable examples exactly, including tab contents.
for (const page of pages.filter(
  (item) => item.slug !== 'ja' && !item.slug.startsWith('ja/'),
)) {
  const file = `${page.slug || 'index'}.mdx`;
  const en = await Bun.file(`${root}/src/content/docs/${file}`).text();
  const ja = await Bun.file(`${root}/src/content/docs/ja/${file}`).text();
  const code = (source: string) =>
    Array.from(
      source.matchAll(/^\s*```[^\n]*\n([\s\S]*?)^\s*```/gmu),
      (match) => match[0],
    );
  if (JSON.stringify(code(en)) !== JSON.stringify(code(ja)))
    errors.push(`Code examples differ between languages: ${file}`);
}
if (errors.length)
  throw new Error(
    `Static documentation validation failed:\n${errors.join('\n')}`,
  );
console.log(
  `Validated ${documents.size} static pages, ${texts.length} agent-readable texts, localized metadata, links, anchors, assets, and bilingual code examples.`,
);
