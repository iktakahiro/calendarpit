import starlight from '@astrojs/starlight';
import { defineConfig, passthroughImageService } from 'astro/config';
import starlightLinksValidator from 'starlight-links-validator';

const repository = 'https://github.com/iktakahiro/calendarpit';

/**
 * The Calendarpit documentation site: a landing page plus the developer
 * documentation, published to GitHub Pages under `/calendarpit/`.
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
      description:
        'A local Google Calendar–compatible API and OAuth server for development and repeatable tests.',
      favicon: '/favicon.svg',
      logo: { src: './src/assets/logo.svg', alt: '' },
      social: [{ icon: 'github', label: 'GitHub', href: repository }],
      editLink: { baseUrl: `${repository}/edit/main/apps/docs/` },
      customCss: ['./src/styles/theme.css'],
      // Fail the build on broken internal links and anchors.
      plugins: [starlightLinksValidator()],
      sidebar: [
        {
          label: 'Getting started',
          items: [
            { label: 'Overview', link: '/' },
            'development',
            'integration',
            'sdks',
            'fixtures',
          ],
        },
        {
          label: 'Product and protocol',
          items: ['mvp', 'compatibility', 'sync', 'watch'],
        },
        {
          label: 'Engineering',
          items: ['architecture', 'testing', 'roadmap'],
        },
      ],
    }),
  ],
});
