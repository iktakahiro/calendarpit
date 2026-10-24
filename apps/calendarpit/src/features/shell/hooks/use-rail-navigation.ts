import { useRouter } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import type { SectionId } from '../models/sections';

/**
 * Keeps the current section visible in the mobile strip and reports hidden
 * content at either edge. Scrolling is instant to respect reduced motion and
 * changes only the strip's horizontal offset, preserving page scroll and focus.
 * The vertical desktop navigation is left alone.
 */
export function useRailNavigation(section: SectionId) {
  const router = useRouter();
  const navRef = useRef<HTMLElement>(null);
  const [overflow, setOverflow] = useState({ before: false, after: false });

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const isStrip = () => getComputedStyle(nav).overflowX === 'auto';
    const updateOverflow = () => {
      const before = isStrip() && nav.scrollLeft > 1;
      const after =
        isStrip() && nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 1;
      setOverflow((previous) =>
        previous.before === before && previous.after === after
          ? previous
          : { before, after },
      );
    };
    const revealActive = () => {
      const active = nav.querySelector<HTMLElement>('[aria-current="page"]');
      if (isStrip() && active) {
        const strip = nav.getBoundingClientRect();
        const button = active.getBoundingClientRect();
        // Leave room for the focus outline inside the scroll viewport.
        const inset = 4;
        const delta =
          button.left < strip.left + inset
            ? button.left - strip.left - inset
            : Math.max(0, button.right - strip.right + inset);
        if (delta !== 0)
          nav.scrollTo({ left: nav.scrollLeft + delta, behavior: 'instant' });
      }
      updateOverflow();
    };

    revealActive();
    // The router's scroll restoration runs after render and carries the
    // strip's previous offset over to the new route, so reveal again after it.
    const unsubscribe = router.subscribe('onRendered', revealActive);
    nav.addEventListener('scroll', updateOverflow, { passive: true });
    // Resizing the strip (rotation, desktop layout) re-pins the active item.
    const stripObserver = new ResizeObserver(revealActive);
    stripObserver.observe(nav);
    // Counts and labels can change button widths while the user is browsing
    // the strip, so only refresh the edge cues instead of scrolling back.
    const buttonObserver = new ResizeObserver(updateOverflow);
    for (const button of nav.querySelectorAll('button'))
      buttonObserver.observe(button);
    let active = true;
    // Web fonts can widen the labels after the first reveal.
    void document.fonts?.ready.then(() => {
      if (active) revealActive();
    });
    return () => {
      active = false;
      unsubscribe();
      stripObserver.disconnect();
      buttonObserver.disconnect();
      nav.removeEventListener('scroll', updateOverflow);
    };
  }, [router, section]);

  return { navRef, overflow };
}
