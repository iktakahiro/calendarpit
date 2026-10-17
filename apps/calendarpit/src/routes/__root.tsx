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
import { AppearanceProvider } from '../components/appearance';

/** Context available to every route. */
export type RouterContext = { queryClient: QueryClient };

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: async () => ({ appearance: await getAppearance() }),
  headers: () => ({ 'Cache-Control': 'private, no-store' }),
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Calendarpit · Local calendar lab' },
      {
        name: 'description',
        content:
          'A local calendar service for development and repeatable tests.',
      },
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
  }),
  shellComponent: RootDocument,
  component: Outlet,
  notFoundComponent: () => (
    <main className='not-found'>
      <p className='eyebrow'>404 / CALENDARPIT</p>
      <h1>Nothing scheduled here.</h1>
      <Link to='/'>Return to the workspace</Link>
    </main>
  ),
});

function RootDocument({ children }: { children: ReactNode }) {
  const { appearance = 'system' } = Route.useRouteContext();
  return (
    <html
      lang='en'
      data-mode={appearance === 'dark' ? 'dark' : 'light'}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: appearanceScript }} />
        <HeadContent />
      </head>
      <body>
        <div id='app' className='isolate'>
          <AppearanceProvider initialPreference={appearance}>
            {children}
          </AppearanceProvider>
        </div>
        <Scripts />
      </body>
    </html>
  );
}
