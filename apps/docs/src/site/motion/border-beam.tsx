import { motion } from 'motion/react';

/**
 * A short beam of light that travels around its parent's border, adapted
 * from Magic UI's Border Beam (MIT). The parent needs `position: relative`
 * and a border radius; beam colors come from `landing-motion.css`.
 */
export function BorderBeam({
  size = 80,
  duration = 8,
  delay = 0,
}: {
  /** Beam length in CSS pixels. */
  size?: number;
  /** Seconds for one lap. */
  duration?: number;
  /** Seconds to offset the lap, so several beams can be staggered. */
  delay?: number;
}) {
  return (
    <span className='border-beam' aria-hidden='true'>
      <motion.span
        className='border-beam-light'
        style={{
          width: size,
          offsetPath: `rect(0 auto auto 0 round ${size}px)`,
        }}
        initial={{ offsetDistance: '0%' }}
        animate={{ offsetDistance: ['0%', '100%'] }}
        transition={{
          repeat: Infinity,
          ease: 'linear',
          duration,
          delay: -delay,
        }}
      />
    </span>
  );
}
