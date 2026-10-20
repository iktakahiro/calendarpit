import { QueryClient } from '@tanstack/react-query';

/**
 * How often the admin UI polls as a fallback. The change stream normally
 * triggers refetches as soon as the server saves a change.
 */
export const pollIntervalMs = 30_000;

/**
 * Creates the query client for one router instance. The server renders each
 * request with its own client, so no cached data leaks between requests.
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        refetchInterval: pollIntervalMs,
        // The change stream already keeps data fresh; avoid refetches on focus.
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });
}
