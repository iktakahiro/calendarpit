import type { ReactNode } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';

/**
 * Tilts its content back in 3D and settles it flat over the first screen of
 * scrolling, driven by Motion's page scroll progress.
 */
export function ScrollTilt({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const { scrollY } = useScroll();
  const rotateX = useTransform(scrollY, [0, 420], [14, 0]);
  const scale = useTransform(scrollY, [0, 420], [0.95, 1]);
  const y = useTransform(scrollY, [0, 420], [0, -24]);
  return (
    <div className='scroll-tilt'>
      <motion.div className={className} style={{ rotateX, scale, y }}>
        {children}
      </motion.div>
    </div>
  );
}
