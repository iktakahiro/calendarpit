import type { PageMetadata } from './source';
import { LandingDiagram } from './landing-diagram';
import { sitePath } from './paths';
import '../styles/landing.css';

/** Product introduction with local routing diagram and localized entry points. */
export function LandingHero({ page }: { page: PageMetadata }) {
  const japanese = page.slug === 'ja';
  const [before, after] = (page.hero?.title ?? '').split('Google Calendar API');
  return (
    <header className='landing-hero'>
      <div className='hero-grid' aria-hidden='true' />
      <div className='hero-copy'>
        <p className='eyebrow'>
          {japanese
            ? 'カレンダー連携アプリ・AI エージェントの開発に'
            : 'For calendar apps and AI agents'}
        </p>
        <h1>
          {before}
          <span className='hero-accent'>Google Calendar API</span>
          {after}
        </h1>
        <p className='hero-description'>{page.hero?.tagline}</p>
        <div className='hero-actions'>
          <a
            className='site-button'
            href={sitePath(japanese ? 'ja/quick-start/' : 'quick-start/')}
          >
            {japanese ? 'クイックスタート' : 'Get started'}{' '}
            <span aria-hidden='true'>→</span>
          </a>
          <a
            className='site-button secondary'
            href='https://github.com/iktakahiro/calendarpit'
          >
            {japanese ? 'GitHub で見る' : 'View on GitHub'}{' '}
            <span aria-hidden='true'>↗</span>
          </a>
        </div>
      </div>
      <div className='hero-workbench'>
        <div className='workbench-title'>
          <span>
            <span className='workbench-led' />
            {japanese
              ? 'Calendar API 連携の開発がローカル環境で完結'
              : 'Develop and test Calendar API integrations locally'}
          </span>
          <code>127.0.0.1:4173</code>
        </div>
        <div className='landing-diagram'>
          <LandingDiagram japanese={japanese} />
        </div>
      </div>
      <div className='hero-footnote'>
        <span>CALENDAR API · OAUTH · WEBHOOKS</span>
        <span>
          {japanese
            ? 'Google 認証情報不要 / 外部通信不要'
            : 'No Google credentials / No external requests'}
        </span>
      </div>
    </header>
  );
}
