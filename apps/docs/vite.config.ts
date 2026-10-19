import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react from '@vitejs/plugin-react';
import { fumadocsMdx } from 'fumadocs-mdx/vite';
import { defineConfig } from 'vite';
import { readPages } from './scripts/content.ts';

const base = process.env.DOCS_BASE_PATH ?? '/';
if (!base.startsWith('/') || !base.endsWith('/') || base.includes('..')) {
  throw new Error(
    'DOCS_BASE_PATH must start and end with / and contain no .. segments.',
  );
}
const site = new URL(process.env.DOCS_SITE_URL ?? 'https://calendarpit.dev');
const contentDirectory = resolve(import.meta.dirname, 'src/content/docs');
const pages = await readPages(contentDirectory);

/** Builds every localized page as portable static HTML, with no runtime API. */
export default defineConfig({
  base,
  define: {
    __DOCS_SITE_URL__: JSON.stringify(site.origin),
  },
  server: { host: '127.0.0.1', port: 4487, strictPort: true },
  plugins: [
    fumadocsMdx({ index: false }),
    tanstackStart({
      prerender: {
        enabled: true,
        crawlLinks: false,
        autoStaticPathsDiscovery: false,
        failOnError: true,
      },
      pages: [
        ...pages.map((page) => ({
          path: `${base}${page.slug ? `${page.slug}/` : ''}`,
        })),
        { path: `${base}404/` },
      ],
    }),
    tailwindcss(),
    react(),
  ],
});
