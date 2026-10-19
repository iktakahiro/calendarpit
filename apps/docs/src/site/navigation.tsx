import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import logoDark from '../assets/logo-dark.svg';
import logoLight from '../assets/logo-light.svg';
import { i18n, localeFromPath } from './i18n';

function homePath(slug: string): string {
  const locale = localeFromPath(slug);
  return locale === i18n.defaultLanguage ? '/' : `/${locale}/`;
}

/** Product navigation; Fumadocs supplies the locale selector and page tree. */
export function layoutOptions(slug: string): BaseLayoutProps {
  const home = homePath(slug);
  return {
    nav: {
      title: (
        <span className='site-brand'>
          <img
            className='site-logo'
            data-theme='light'
            src={logoLight}
            width={182}
            height={22}
            alt='Calendarpit'
          />
          <img
            className='site-logo'
            data-theme='dark'
            src={logoDark}
            width={182}
            height={22}
            alt='Calendarpit'
          />
        </span>
      ),
      url: home,
    },
    githubUrl: 'https://github.com/iktakahiro/calendarpit',
    searchToggle: { enabled: false },
  };
}

/**
 * Navigation for pages outside the docs sidebar (landing and 404), which add a
 * Documentation link that the docs pages do not need.
 */
export function homeLayoutOptions(slug: string): BaseLayoutProps {
  const japanese = localeFromPath(slug) === 'ja';
  return {
    ...layoutOptions(slug),
    links: [
      {
        text: japanese ? 'ドキュメント' : 'Documentation',
        url: `${homePath(slug)}quick-start/`,
      },
    ],
  };
}
