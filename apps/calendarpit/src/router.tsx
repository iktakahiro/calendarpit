import { QueryClientProvider } from '@tanstack/react-query';
import { createRouter } from '@tanstack/react-router';
import { createQueryClient } from './lib/query-client';
import { routeTree } from './routeTree.gen';

/** Creates the router with a fresh query client, once per request on the server. */
export function getRouter() {
  const queryClient = createQueryClient();
  return createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    Wrap: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
