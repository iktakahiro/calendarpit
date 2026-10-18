import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { sitePath } from './paths';
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
          <img src={sitePath('favicon.svg')} width={28} height={28} alt='' />
          Calendarpit
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
