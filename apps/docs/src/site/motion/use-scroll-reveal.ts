import { useEffect, type RefObject } from 'react';
import { animate, inView } from 'motion';

const targets = [
  '.landing-body > h2',
  '.landing-body > p',
  '.landing-body > .hero-actions',
  '.landing-body [data-card]',
  '.landing-body .fd-steps > .fd-step',
].join(', ');

/**
 * Fades landing body blocks up as they scroll into view, staggering siblings
 * such as cards in one grid. Blocks already on screen at mount stay put, so
 * hydration never hides content the reader can see.
 */
export function useScrollReveal(
  root: RefObject<HTMLElement | null>,
  enabled: boolean,
) {
  useEffect(() => {
    const container = root.current;
    if (!enabled || !container) return;
    const pending = [
      ...container.querySelectorAll<HTMLElement>(targets),
    ].filter(
      (element) => element.getBoundingClientRect().top > window.innerHeight,
    );
    for (const element of pending) element.dataset.reveal = 'pending';
    const stop = inView(
      pending,
      (element) => {
        if (!(element instanceof HTMLElement)) return;
        const siblings = element.parentElement?.children ?? [];
        const index = Array.prototype.indexOf.call(siblings, element) % 3;
        element.dataset.reveal = 'shown';
        animate(
          element,
          { opacity: [0, 1], y: [18, 0] },
          { duration: 0.7, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] },
        );
      },
      { margin: '0px 0px -12% 0px' },
    );
    return () => {
      stop();
      for (const element of pending) {
        delete element.dataset.reveal;
        element.style.removeProperty('opacity');
        element.style.removeProperty('transform');
      }
    };
  }, [root, enabled]);
}
