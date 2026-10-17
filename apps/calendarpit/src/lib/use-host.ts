import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/**
 * Returns the page's `host`, or an empty string during server rendering, so
 * the server and the first client render agree.
 */
export const useHost = () =>
  useSyncExternalStore(
    subscribe,
    () => window.location.host,
    () => '',
  );
