import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { readPages } from './content';
import { i18n, localeFromPath } from '../src/site/i18n';
import { markdownFile } from '../src/site/paths';

const root = resolve(import.meta.dirname, '..');
const content = `${root}/src/content/docs`;
const dist = `${root}/dist`;
const base = process.env.DOCS_BASE_PATH ?? '/';
const site = `${new URL(process.env.DOCS_SITE_URL ?? 'https://calendarpit.dev').origin}${base}`;
const slugs = new Set((await readPages(content)).map((page) => page.slug));

const intro: Record<string, (other: string) => string> = {
  en: (other) =>
    `Each link points to the Markdown version of a documentation page. [llms-full.txt](${site}llms-full.txt) contains every page in one file. Japanese: [ja/llms.txt](${other}).`,
  ja: (other) =>
    `各リンクはドキュメントページの Markdown 版です。全ページを1ファイルにまとめたものは [llms-full.txt](${site}ja/llms-full.txt) にあります。English: [llms.txt](${other}).`,
};

type Page = { slug: string; title: string; description: string; body: string };

/** Splits validated frontmatter from the MDX body of one page. */
async function readPage(slug: string): Promise<Page> {
  const locale = localeFromPath(slug);
  const rest = slug
    .split('/')
    .slice(locale === i18n.defaultLanguage ? 0 : 1)
    .join('/');
  const prefix = locale === i18n.defaultLanguage ? '' : `${locale}/`;
  const source = await Bun.file(
    `${content}/${prefix}${rest || 'index'}.mdx`,
  ).text();
  const match = /^---\n([\s\S]*?)\n---\n/u.exec(source);
  const data: unknown = match ? Bun.YAML.parse(match[1] ?? '') : undefined;
  if (
    !match ||
    typeof data !== 'object' ||
    data === null ||
    !('title' in data) ||
    typeof data.title !== 'string' ||
    !('description' in data) ||
    typeof data.description !== 'string'
  )
    throw new Error(`Missing title or description frontmatter: ${slug}`);
  return {
    slug,
    title: data.title,
    description: data.description,
    body: toMarkdown(source.slice(match[0].length).trim()),
  };
}

/** Resolves a router path to an absolute URL, preferring a page's Markdown. */
function absolute(path: string): string {
  const [pathname = '', hash] = path.split('#');
  const slug = pathname.replace(/\/$/u, '');
  const target = slugs.has(slug) ? markdownFile(slug) : pathname;
  return `${site}${target}${hash === undefined ? '' : `#${hash}`}`;
}

const alerts: Record<string, string> = { info: 'NOTE', warn: 'WARNING' };

/**
 * Makes router-relative links absolute and turns callouts into GitHub alerts,
 * leaving fenced code untouched. Other MDX components stay as JSX.
 */
function toMarkdown(body: string): string {
  let fence = '';
  let quote = false;
  const lines: string[] = [];
  for (const line of body.split('\n')) {
    let text = line;
    const marker = /^\s*(`{3,}|~{3,})(.*)$/u.exec(line);
    if (marker?.[1]) {
      if (!fence) fence = marker[1];
      else if (
        marker[1][0] === fence[0] &&
        marker[1].length >= fence.length &&
        !marker[2]?.trim()
      )
        fence = '';
    } else if (!fence) {
      const callout = /^<Callout(?:\s+type=["'](\w+)["'])?\s*>$/u.exec(line);
      if (callout) {
        const alert = alerts[callout[1] ?? 'info'];
        if (!alert) throw new Error(`Unsupported callout type: ${callout[1]}`);
        lines.push(`> [!${alert}]`);
        quote = true;
        continue;
      }
      if (quote && line === '</Callout>') {
        quote = false;
        continue;
      }
      text = line.replace(
        /(\]\(|href=["'])\/(?!\/)([^)"'\s]*)/gu,
        (_, opening: string, path: string) => `${opening}${absolute(path)}`,
      );
    }
    lines.push(quote ? (text ? `> ${text}` : '>') : text);
  }
  return lines.join('\n');
}

/** Renders one page as standalone Markdown, optionally naming its HTML URL. */
function markdown(page: Page, source = false): string {
  const url = source
    ? `Source: ${site}${page.slug ? `${page.slug}/` : ''}\n\n`
    : '';
  return `# ${page.title}\n\n> ${page.description}\n\n${url}${page.body}\n`;
}

/** Reads meta.json navigation as sections in reading order. */
async function readSections(
  locale: string,
): Promise<{ title: string; pages: string[] }[]> {
  const prefix = locale === i18n.defaultLanguage ? '' : `${locale}/`;
  const meta: unknown = await Bun.file(`${content}/${prefix}meta.json`).json();
  if (
    typeof meta !== 'object' ||
    meta === null ||
    !('pages' in meta) ||
    !Array.isArray(meta.pages)
  )
    throw new Error(`Invalid navigation: ${prefix}meta.json`);
  const sections: { title: string; pages: string[] }[] = [];
  let title = '';
  for (const entry of meta.pages) {
    if (typeof entry !== 'string')
      throw new Error(`Invalid navigation entry in ${prefix}meta.json`);
    const separator = /^---(?:\[[^\]]+\])?(.+)---$/u.exec(entry);
    if (separator?.[1]) {
      title = separator[1];
      continue;
    }
    const slug = `${prefix}${entry === 'index' ? '' : entry}`.replace(
      /\/$/u,
      '',
    );
    const section = sections.at(-1);
    if (section?.title === title) section.pages.push(slug);
    else sections.push({ title, pages: [slug] });
  }
  return sections;
}

async function write(path: string, text: string): Promise<void> {
  await mkdir(dirname(`${dist}/${path}`), { recursive: true });
  await Bun.write(`${dist}/${path}`, text);
}

for (const locale of i18n.languages) {
  const prefix = locale === i18n.defaultLanguage ? '' : `${locale}/`;
  const sections = await readSections(locale);
  const ordered = sections.flatMap((section) => section.pages);
  const localized = [...slugs].filter(
    (slug) => localeFromPath(slug) === locale,
  );
  const missing = localized.filter((slug) => !ordered.includes(slug));
  if (missing.length)
    throw new Error(`Pages missing from navigation: ${missing.join(', ')}`);
  const pages = new Map<string, Page>();
  for (const slug of ordered) pages.set(slug, await readPage(slug));

  for (const page of pages.values())
    await write(markdownFile(page.slug), markdown(page));

  const home = pages.get(prefix.replace(/\/$/u, ''));
  if (!home) throw new Error(`Missing home page for ${locale}`);
  const other =
    locale === i18n.defaultLanguage ? `${site}ja/llms.txt` : `${site}llms.txt`;
  const index = [
    `# Calendarpit\n\n> ${home.description}\n\n${intro[locale]?.(other) ?? ''}`,
    ...sections.map(
      (section) =>
        `## ${section.title}\n\n${section.pages
          .map((slug) => {
            const page = pages.get(slug);
            return `- [${page?.title}](${site}${markdownFile(slug)}): ${page?.description}`;
          })
          .join('\n')}`,
    ),
  ].join('\n\n');
  await write(`${prefix}llms.txt`, `${index}\n`);

  const full = [...pages.values()].map((page) => markdown(page, true));
  await write(`${prefix}llms-full.txt`, full.join('\n'));
}
console.log('Generated llms.txt, llms-full.txt, and per-page Markdown.');
