import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import logoDark from '../assets/logo-dark.svg';
import logoLight from '../assets/logo-light.svg';
import { i18n, localeFromPath } from './i18n';

/** Product navigation; Fumadocs supplies the locale selector and page tree. */
export function layoutOptions(slug: string): BaseLayoutProps {
  const locale = localeFromPath(slug);
  const japanese = locale === 'ja';
  const home = locale === i18n.defaultLanguage ? '/' : `/${locale}/`;
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
    links: [
      {
        text: japanese ? 'ドキュメント' : 'Documentation',
        url: `${home}quick-start/`,
      },
    ],
  };
}
