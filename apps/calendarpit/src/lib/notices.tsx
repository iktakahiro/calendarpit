import { Toasty, useKumoToastManager } from '@cloudflare/kumo/components/toast';
import type { ReactNode } from 'react';

/** How long a success notice stays visible. */
const noticeMs = 5000;

type Notices = {
  /** Shows a success message. */
  succeed: (message: string) => void;
  /** Shows an error message that stays until it is dismissed. */
  fail: (error: unknown) => void;
};

/**
 * Provides app-wide success and error toasts, and the viewport that shows
 * them. Wraps the part of the tree that reports outcomes.
 */
export function NoticesProvider({ children }: { children: ReactNode }) {
  return <Toasty>{children}</Toasty>;
}

/**
 * Returns the app-wide notices.
 *
 * @throws Error outside {@link NoticesProvider}.
 */
export function useNotices(): Notices {
  const toasts = useKumoToastManager();
  return {
    succeed: (message) => {
      toasts.add({ title: message, variant: 'success', timeout: noticeMs });
    },
    fail: (value) => {
      toasts.add({
        title: value instanceof Error ? value.message : String(value),
        variant: 'error',
        // Errors explain a failed action, so the reader dismisses them.
        timeout: 0,
        priority: 'high',
      });
    },
  };
}
