import type { PageMetadata } from './source';
import { LandingDiagram } from './landing-diagram';
import { sitePath } from './paths';
import { useLandingMotion } from './motion/landing-motion';
import { AnimatedGridPattern } from './motion/animated-grid-pattern';
import { BorderBeam } from './motion/border-beam';
import { ScrollTilt } from './motion/scroll-tilt';
import '../styles/landing.css';

const accent = 'Google Calendar API';

/** Product introduction with local routing diagram and localized entry points. */
export function LandingHero({ page }: { page: PageMetadata }) {
  const motion = useLandingMotion();
  const japanese = page.slug === 'ja';
  const [before, after] = (page.hero?.title ?? '').split(accent);

  const workbench = (
    <>
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
    </>
  );

  return (
    <header className='landing-hero'>
      {motion ? (
        <div className='hero-grid' data-animated='' aria-hidden='true'>
          <AnimatedGridPattern />
        </div>
      ) : (
        <div className='hero-grid' aria-hidden='true' />
      )}
      <div className='hero-copy'>
        <p className='eyebrow hero-rise' style={{ '--rise': -3 }}>
          <span className='eyebrow-orb' aria-hidden='true' />
          <span className='eyebrow-chip'>
            {japanese ? '開発者向け' : 'For developers'}
          </span>
          <span className='eyebrow-text'>
            {japanese
              ? 'カレンダー連携アプリと AI エージェント'
              : 'Calendar apps and AI agents'}
          </span>
        </p>
        <h1>
          {before}
          <span className='hero-accent'>{accent}</span>
          {after}
        </h1>
        <p className='hero-description hero-rise' style={{ '--rise': 1 }}>
          {page.hero?.tagline}
        </p>
        <div className='hero-actions hero-rise' style={{ '--rise': 2 }}>
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
      {motion ? (
        <ScrollTilt className='hero-workbench'>
          {workbench}
          <BorderBeam size={140} duration={10} />
          <BorderBeam size={140} duration={10} delay={5} />
        </ScrollTilt>
      ) : (
        <div className='hero-workbench'>{workbench}</div>
      )}
    </header>
  );
}
