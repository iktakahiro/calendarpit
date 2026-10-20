import { sitePath } from './paths';
import './demo-video.css';

const labels = {
  en: 'Calendarpit demo: an app under test creates an event with a local OAuth token, and the request appears in the admin UI history',
  ja: 'Calendarpit のデモ動画：テスト対象のアプリがローカル OAuth のトークンで予定を作成し、そのリクエストが管理画面の履歴に表示されます',
};

/**
 * Narrated product demo served from the site's own static assets. The video
 * waits for the reader to press play, since autoplay would have to mute the
 * narration.
 */
export function DemoVideo({ lang = 'en' }: { lang?: 'en' | 'ja' }) {
  return (
    <figure className='demo-video not-prose'>
      <video
        controls
        playsInline
        preload='metadata'
        width={1920}
        height={1080}
        poster={sitePath('calendarpit-demo-poster.jpg')}
        aria-label={labels[lang]}
      >
        <source src={sitePath('calendarpit-demo.mp4')} type='video/mp4' />
      </video>
    </figure>
  );
}
