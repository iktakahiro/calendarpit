import type { PageMetadata } from './source';
import { LandingDiagram } from './landing-diagram';
import { sitePath } from './paths';
import { LazyMotion, domAnimation, m, useReducedMotion } from 'motion/react';
import '../styles/landing.css';

/** Product introduction with local routing diagram and localized entry points. */
export function LandingHero({ page }: { page: PageMetadata }) {
  const japanese = page.slug === 'ja';
  const reduceMotion = useReducedMotion();
  const [before, after] = (page.hero?.title ?? '').split('Google Calendar API');
  return (
    <LazyMotion features={domAnimation}>
      <header className='landing-hero'>
        <div className='hero-grid' aria-hidden='true' />
        <m.div
          className='hero-copy'
          initial={false}
          animate={reduceMotion ? {} : { y: [18, 0], opacity: [0.7, 1] }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        >
          <p className='eyebrow'>
            <span className='status-dot' />
            {page.eyebrow}
          </p>
          <h1>
            {before}
            <span className='hero-accent'>Google Calendar API</span>
            {after}
          </h1>
          <p className='hero-description'>{page.hero?.tagline}</p>
          <div className='hero-actions'>
            <m.a
              className='site-button'
              whileHover={reduceMotion ? {} : { y: -3 }}
              whileTap={reduceMotion ? {} : { scale: 0.98 }}
              href={sitePath(japanese ? 'ja/quick-start/' : 'quick-start/')}
            >
              {japanese ? 'クイックスタート' : 'Get started'}{' '}
              <span aria-hidden='true'>→</span>
            </m.a>
            <a
              className='site-button secondary'
              href='https://github.com/iktakahiro/calendarpit'
            >
              {japanese ? 'GitHub で見る' : 'View on GitHub'}{' '}
              <span aria-hidden='true'>↗</span>
            </a>
          </div>
          <div className='hero-install'>
            <span aria-hidden='true'>$</span>
            <code>brew install iktakahiro/tap/calendarpit</code>
          </div>
        </m.div>
        <m.div
          className='hero-workbench'
          initial={false}
          animate={reduceMotion ? {} : { y: [24, 0], opacity: [0.75, 1] }}
          transition={{ duration: 0.9, ease: 'easeOut', delay: 0.12 }}
        >
          <div className='workbench-title'>
            <span>
              <span className='workbench-led' />
              {japanese
                ? 'すべて、ローカルで。'
                : 'Your entire test loop. Local.'}
            </span>
            <code>127.0.0.1:4173</code>
          </div>
          <div className='landing-diagram'>
            <LandingDiagram japanese={japanese} />
          </div>
        </m.div>
        <div className='hero-footnote'>
          <span>CALENDAR API · OAUTH · WEBHOOKS</span>
          <span>
            {japanese
              ? 'Google 認証情報不要 / 外部通信不要'
              : 'No Google credentials / No external requests'}
          </span>
        </div>
      </header>
    </LazyMotion>
  );
}
