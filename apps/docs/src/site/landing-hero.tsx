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
    <div className='landing-diagram'>
      <LandingDiagram japanese={japanese} />
    </div>
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
          <span className='eyebrow-chip'>
            <span className='eyebrow-orb' aria-hidden='true' />
            MIT License
          </span>
          <span className='eyebrow-text'>
            Built for apps and AI agents that use Google Calendar
          </span>
          {motion && <BorderBeam size={64} duration={7} />}
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
