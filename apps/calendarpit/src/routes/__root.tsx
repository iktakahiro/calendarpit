import type { QueryClient } from '@tanstack/react-query';
import {
  createRootRouteWithContext,
  HeadContent,
  Link,
  Outlet,
  Scripts,
} from '@tanstack/react-router';
import type { ReactNode } from 'react';
import appCss from '../app.css?url';
import { getAppearance } from '../lib/appearance.functions';
import { appearanceScript } from '../lib/appearance';
import { getLanguage } from '../lib/locale.functions';
import { messages } from '../lib/messages';
import { AppearanceProvider } from '../components/appearance';
import { LanguageProvider, useMessages } from '../components/language';

/** Context available to every route. */
export type RouterContext = { queryClient: QueryClient };

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: async () => {
    const [appearance, language] = await Promise.all([
      getAppearance(),
      getLanguage(),
    ]);
    return { appearance, language };
  },
  headers: () => ({ 'Cache-Control': 'private, no-store' }),
  head: ({ match }) => {
    const t = messages[localeOf(match.context.language)];
    return {
      meta: [
        { charSet: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { title: t['meta.title'] },
        { name: 'description', content: t['meta.description'] },
      ],
      links: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        {
          rel: 'preconnect',
          href: 'https://fonts.gstatic.com',
          crossOrigin: 'anonymous',
        },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400..600&display=swap',
        },
        { rel: 'stylesheet', href: appCss },
        { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
      ],
    };
  },
  shellComponent: RootDocument,
  component: Outlet,
  notFoundComponent: NotFound,
});

/** The rendered locale for the route context's language, English until loaded. */
const localeOf = (language?: RouteLanguage) =>
  !language
    ? 'en'
    : language.preference === 'system'
      ? language.systemLocale
      : language.preference;

type RouteLanguage = Awaited<ReturnType<typeof getLanguage>>;

function NotFound() {
  const t = useMessages();
  return (
    <main className='not-found'>
      <p className='eyebrow'>404 / CALENDARPIT</p>
      <h1>{t['notFound.title']}</h1>
      <Link to='/'>{t['notFound.link']}</Link>
    </main>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  const { appearance = 'system', language } = Route.useRouteContext();
  // System mode renders dark until the script reads the device preference.
  return (
    <html
      lang={localeOf(language)}
      data-mode={appearance === 'light' ? 'light' : 'dark'}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: appearanceScript }} />
        <HeadContent />
      </head>
      <body>
        <div id='app' className='isolate'>
          <AppearanceProvider initialPreference={appearance}>
            <LanguageProvider
              initialPreference={language?.preference ?? 'system'}
              systemLocale={language?.systemLocale ?? 'en'}
            >
              {children}
            </LanguageProvider>
          </AppearanceProvider>
        </div>
        <Scripts />
      </body>
    </html>
  );
}
