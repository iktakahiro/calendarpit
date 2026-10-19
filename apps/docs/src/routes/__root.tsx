import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
  useRouterState,
} from '@tanstack/react-router';
import { RootProvider } from 'fumadocs-ui/provider/tanstack';
import { translations } from '../site/translations';
import { i18nProvider } from 'fumadocs-ui/i18n';
import { localeFromPath } from '../site/i18n';
import { SiteLink } from '../site/site-link';
import { sitePath } from '../site/paths';
import { NotFoundPage } from '../site/not-found-page';
import '../styles/theme.css';

/** Document shell shared by every prerendered page and client-side navigation. */
export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    ],
    links: [
      { rel: 'icon', href: sitePath('favicon.svg'), type: 'image/svg+xml' },
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      {
        rel: 'preconnect',
        href: 'https://fonts.gstatic.com',
        crossOrigin: 'anonymous',
      },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Geist:wght@400..700&family=Noto+Sans+JP:wght@400..700&family=Roboto+Mono:wght@400..600&display=swap',
      },
    ],
  }),
  component: Root,
  notFoundComponent: NotFoundPage,
});

function Root() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const locale = localeFromPath(pathname);
  const japanese = locale === 'ja';
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <a href='#main-content' className='skip-link'>
          {japanese ? '本文へスキップ' : 'Skip to content'}
        </a>
        <RootProvider
          components={{ Link: SiteLink }}
          search={{ enabled: false }}
          theme={{ defaultTheme: 'dark' }}
          i18n={i18nProvider(translations, locale)}
        >
          <Outlet />
        </RootProvider>
        <Scripts />
      </body>
    </html>
  );
}
