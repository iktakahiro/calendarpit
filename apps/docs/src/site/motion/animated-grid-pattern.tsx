import { useEffect, useId, useRef, useState } from 'react';
import { motion } from 'motion/react';

type Square = { id: number; x: number; y: number; iteration: number };

/**
 * SVG line grid whose cells softly light up one by one, adapted from Magic
 * UI's Animated Grid Pattern (MIT). Cells appear only after hydration and
 * measurement, so prerendered HTML holds the plain grid. Stroke and fill come
 * from `landing-motion.css`.
 */
export function AnimatedGridPattern({
  size = 64,
  count = 14,
  maxOpacity = 0.5,
  duration = 3.5,
}: {
  /** Cell edge in CSS pixels; matches the static hero grid. */
  size?: number;
  /** Cells lit at the same time. */
  count?: number;
  maxOpacity?: number;
  /** Seconds to fade a cell in, then the same to fade it out. */
  duration?: number;
}) {
  const id = `grid${useId().replace(/[^\w-]/gu, '')}`;
  const ref = useRef<SVGSVGElement>(null);
  const bounds = useRef({ cols: 0, rows: 0 });
  const [squares, setSquares] = useState<Square[]>([]);

  const position = () => ({
    x: Math.floor(Math.random() * bounds.current.cols),
    y: Math.floor(Math.random() * bounds.current.rows),
  });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const cols = Math.floor(entry.contentRect.width / size);
      const rows = Math.floor(entry.contentRect.height / size);
      if (cols === bounds.current.cols && rows === bounds.current.rows) return;
      bounds.current = { cols, rows };
      setSquares(
        cols && rows
          ? Array.from({ length: count }, (_, index) => ({
              id: index,
              iteration: 0,
              x: Math.floor(Math.random() * cols),
              y: Math.floor(Math.random() * rows),
            }))
          : [],
      );
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [size, count]);

  const move = (squareId: number) =>
    setSquares((current) =>
      current.map((square) =>
        square.id === squareId
          ? { ...square, ...position(), iteration: square.iteration + 1 }
          : square,
      ),
    );

  return (
    <svg ref={ref} className='animated-grid' aria-hidden='true'>
      <defs>
        <pattern
          id={id}
          width={size}
          height={size}
          patternUnits='userSpaceOnUse'
        >
          <path d={`M.5 ${size}V.5H${size}`} fill='none' />
        </pattern>
      </defs>
      <rect width='100%' height='100%' fill={`url(#${id})`} />
      {squares.map((square, index) => (
        <motion.rect
          key={`${square.id}-${square.iteration}`}
          className='animated-grid-cell'
          initial={{ opacity: 0 }}
          animate={{ opacity: maxOpacity }}
          transition={{
            duration,
            repeat: 1,
            repeatType: 'reverse',
            delay: index * 0.25,
            repeatDelay: 0.6,
          }}
          onAnimationComplete={() => move(square.id)}
          x={square.x * size + 1}
          y={square.y * size + 1}
          width={size - 1}
          height={size - 1}
        />
      ))}
    </svg>
  );
}
