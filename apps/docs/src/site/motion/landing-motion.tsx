import { createContext, use, useRef, type ReactNode } from 'react';
import { MotionConfig, useReducedMotion } from 'motion/react';
import { useMagicCard } from './use-magic-card';
import { useScrollReveal } from './use-scroll-reveal';
import '../../styles/landing-motion.css';

const MotionContext = createContext(false);

/** Returns whether landing motion runs; false under reduced motion. */
export function useLandingMotion(): boolean {
  return use(MotionContext);
}

/**
 * Landing page root that owns motion. Motion adapts MIT-licensed Magic UI
 * components to the landing palette: an Animated Grid Pattern hero, a Border
 * Beam workbench that settles flat as the page scrolls, Animated Shiny Text,
 * and Magic Card glows with scroll reveals in the body. Prerendered HTML has
 * motion on; a reduced-motion preference turns it off after hydration, and
 * the CSS rule in `landing.css` stops animations before then.
 */
export function LandingMotionRoot({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const enabled = !useReducedMotion();
  useScrollReveal(ref, enabled);
  useMagicCard(ref, enabled);

  return (
    <MotionContext value={enabled}>
      <MotionConfig reducedMotion='user'>
        <main
          ref={ref}
          id='main-content'
          className='landing'
          data-motion={enabled ? 'on' : 'off'}
        >
          {children}
        </main>
      </MotionConfig>
    </MotionContext>
  );
}
