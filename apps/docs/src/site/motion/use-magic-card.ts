import { useEffect, type RefObject } from 'react';

/**
 * Lights linked landing cards around the pointer, after Magic UI's Magic
 * Card (MIT): a radial gradient on the border and a faint wash inside. The
 * hook writes the pointer position into `--pointer-x` and `--pointer-y` on
 * the hovered card, and `landing-motion.css` draws the gradient, so the
 * Fumadocs cards need no wrapper markup.
 */
export function useMagicCard(
  root: RefObject<HTMLElement | null>,
  enabled: boolean,
) {
  useEffect(() => {
    const container = root.current;
    if (!enabled || !container) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches)
      return;
    const onPointerMove = (event: PointerEvent) => {
      if (!(event.target instanceof Element)) return;
      const card = event.target.closest<HTMLElement>(
        '.landing-body .grid > [data-card]',
      );
      if (!card) return;
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--pointer-x', `${event.clientX - rect.left}px`);
      card.style.setProperty('--pointer-y', `${event.clientY - rect.top}px`);
    };
    container.addEventListener('pointermove', onPointerMove, { passive: true });
    return () => container.removeEventListener('pointermove', onPointerMove);
  }, [root, enabled]);
}
