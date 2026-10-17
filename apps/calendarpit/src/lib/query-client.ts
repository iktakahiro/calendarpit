import { QueryClient } from '@tanstack/react-query';

/** How often the admin UI polls for changes made by other applications. */
export const pollIntervalMs = 2000;

/**
 * Creates the query client for one router instance. The server renders each
 * request with its own client, so no cached data leaks between requests.
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        refetchInterval: pollIntervalMs,
        // Polling already keeps data fresh; avoid duplicate requests on focus.
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });
}
