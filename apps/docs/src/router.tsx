import { createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';

/** Creates the documentation router; all loaders use bundled local content. */
export function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    trailingSlash: 'always',
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
