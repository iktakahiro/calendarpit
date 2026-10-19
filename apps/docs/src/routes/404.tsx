import { createFileRoute } from '@tanstack/react-router';
import { NotFoundPage } from '../site/not-found-page';

/** Prerender target copied to the host's conventional 404.html output. */
export const Route = createFileRoute('/404')({
  head: () => ({
    meta: [
      { title: 'Page not found | Calendarpit' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: NotFoundPage,
});
