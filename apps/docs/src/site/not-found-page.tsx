import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { homeLayoutOptions } from './navigation';
import { sitePath } from './paths';

/** Bilingual static error page used by hosts and unknown client-side routes. */
export function NotFoundPage() {
  return (
    <HomeLayout {...homeLayoutOptions('')}>
      <main id='main-content' className='not-found'>
        <p className='eyebrow'>404 / Calendarpit</p>
        <h1>Page not found</h1>
        <p>
          This page does not exist. Check the address or return to the
          documentation.
        </p>
        <a className='site-button' href={sitePath('quick-start/')}>
          Quick start →
        </a>
        <p lang='ja'>
          このページは存在しません。URL
          を確認するか、ドキュメントに戻ってください。
        </p>
        <a
          className='site-button secondary'
          lang='ja'
          href={sitePath('ja/quick-start/')}
        >
          クイックスタート →
        </a>
      </main>
    </HomeLayout>
  );
}
