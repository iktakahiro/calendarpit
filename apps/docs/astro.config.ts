import starlight from '@astrojs/starlight';
import { defineConfig, passthroughImageService } from 'astro/config';
import starlightLinksValidator from 'starlight-links-validator';

const repository = 'https://github.com/iktakahiro/calendarpit';

/**
 * The Calendarpit documentation site: a landing page plus the user-facing
 * documentation in English and Japanese, published to GitHub Pages under
 * `/calendarpit/`.
 */
export default defineConfig({
  site: 'https://iktakahiro.github.io',
  base: '/calendarpit',
  // The site only ships SVGs, so it needs no native image processor (sharp).
  image: { service: passthroughImageService() },
  vite: {
    ssr: {
      // satteri loads a platform-specific native binding. Bundling it into the
      // prerender chunk hides that binding from Bun's isolated node_modules.
      external: ['satteri'],
    },
  },
  integrations: [
    starlight({
      title: 'Calendarpit',
      // `src/pages/404.astro` renders the 404 page.
      disable404Route: true,
      description:
        'A local Google Calendar–compatible API and OAuth server for development and repeatable tests.',
      favicon: '/favicon.svg',
      logo: { src: './src/assets/logo.svg', alt: '' },
      social: [{ icon: 'github', label: 'GitHub', href: repository }],
      editLink: { baseUrl: `${repository}/edit/main/apps/docs/` },
      // The admin UI's typeface, so the site and the product read as one.
      head: [
        {
          tag: 'link',
          attrs: { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        },
        {
          tag: 'link',
          attrs: {
            rel: 'preconnect',
            href: 'https://fonts.gstatic.com',
            crossorigin: true,
          },
        },
        {
          tag: 'link',
          attrs: {
            rel: 'stylesheet',
            href: 'https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400..600&display=swap',
          },
        },
      ],
      customCss: ['./src/styles/theme.css'],
      // The landing pages' hero adds an eyebrow label and the routing diagram.
      components: { Hero: './src/components/Hero.astro' },
      // English is the root locale, so its URLs carry no prefix.
      defaultLocale: 'root',
      locales: {
        root: { label: 'English', lang: 'en' },
        ja: { label: '日本語', lang: 'ja' },
      },
      // Fail the build on broken internal links and anchors.
      plugins: [starlightLinksValidator()],
      sidebar: [
        {
          label: 'Getting started',
          translations: { ja: 'はじめに' },
          items: [
            { label: 'Overview', translations: { ja: '概要' }, link: '/' },
            'quick-start',
            'installation',
            'running',
          ],
        },
        {
          label: 'Connect your app',
          translations: { ja: 'アプリとつなぐ' },
          items: ['connect', 'oauth', 'sdks'],
        },
        {
          label: 'Test your app',
          translations: { ja: 'テストに使う' },
          items: ['fixtures', 'test-control', 'storage'],
        },
        {
          label: 'Calendar API',
          translations: { ja: 'Calendar API' },
          items: ['compatibility', 'recurrence', 'sync', 'watch'],
        },
        {
          label: 'Help',
          translations: { ja: 'ヘルプ' },
          items: ['scope', 'troubleshooting'],
        },
      ],
    }),
  ],
});
