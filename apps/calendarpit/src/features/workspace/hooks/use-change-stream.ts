import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

/** The management API's Server-Sent Events stream of workspace changes. */
const changesUrl = '/__calendarpit/changes';

/** Collapses a burst of change events into one refetch. */
const coalesceMs = 100;

/** How long to wait before reopening a stream the browser gave up on. */
const reopenMs = 2000;

/** Whether the change stream is connected. */
export type ChangeStreamState = 'connecting' | 'open' | 'offline';

/**
 * Subscribes to `GET /__calendarpit/changes` and invalidates the workspace
 * queries whenever the server saves a change, so changes made by other
 * applications appear at once. Every (re)connection also invalidates them,
 * because changes may have happened while the stream was down. The query
 * client's slow polling remains the fallback.
 *
 * @returns The stream's connection state.
 */
export function useChangeStream(): ChangeStreamState {
  const queryClient = useQueryClient();
  const [state, setState] = useState<ChangeStreamState>('connecting');
  useEffect(() => {
    let source: EventSource | undefined;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    let reopenTimer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      refreshTimer ??= setTimeout(() => {
        refreshTimer = undefined;
        void queryClient.invalidateQueries({ queryKey: ['workspace'] });
      }, coalesceMs);
    };
    const open = () => {
      source = new EventSource(changesUrl);
      source.addEventListener('open', () => {
        setState('open');
        refresh();
      });
      source.addEventListener('change', refresh);
      source.addEventListener('error', () => {
        setState('offline');
        // The browser retries network errors itself but gives up after an
        // HTTP error, such as a 503 while the dev server reloads.
        if (source?.readyState === EventSource.CLOSED)
          reopenTimer = setTimeout(open, reopenMs);
      });
    };
    open();
    return () => {
      source?.close();
      clearTimeout(refreshTimer);
      clearTimeout(reopenTimer);
    };
  }, [queryClient]);
  return state;
}
