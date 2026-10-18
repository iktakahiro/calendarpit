import {
  ArrowRotateLeft,
  ArrowRotateRight,
  BroadcastSignal,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleXmark,
  Code,
  Copy,
  Database,
  Display,
  Gear,
  Magnifier,
  Moon,
  Pencil,
  Persons,
  PlugConnection,
  Plus,
  Shield,
  Signal,
  Sun,
  TrashBin,
  Xmark,
} from '@gravity-ui/icons';

const icons = {
  arrowRotateLeft: ArrowRotateLeft,
  arrowRotateRight: ArrowRotateRight,
  broadcast: BroadcastSignal,
  calendar: Calendar,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  check: CircleCheck,
  circleXmark: CircleXmark,
  code: Code,
  copy: Copy,
  database: Database,
  display: Display,
  gear: Gear,
  magnifier: Magnifier,
  moon: Moon,
  pencil: Pencil,
  persons: Persons,
  plug: PlugConnection,
  plus: Plus,
  shield: Shield,
  signal: Signal,
  sun: Sun,
  trash: TrashBin,
  xmark: Xmark,
};

export type IconName = keyof typeof icons;

export function Icon({
  name,
  className,
}: {
  name: IconName;
  className?: string;
}) {
  const Component = icons[name];
  return <Component aria-hidden='true' className={`icon ${className ?? ''}`} />;
}

/** Top-left corners of the mark's 3 x 3 grid; the centre cell is left empty. */
const markCells = [
  [4, 4],
  [24, 4],
  [44, 4],
  [4, 24],
  [44, 24],
  [4, 44],
  [24, 44],
  [44, 44],
] as const;

/**
 * The Calendarpit mark: a 3 x 3 grid of calendar cells with the centre
 * missing and the last cell in the signal color. The cells take the current
 * text color.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden='true'
      className={className}
      viewBox='4 4 56 56'
      xmlns='http://www.w3.org/2000/svg'
    >
      {markCells.map(([x, y], index) => (
        <rect
          key={`${x}-${y}`}
          x={x}
          y={y}
          width='16'
          height='16'
          fill={
            index === markCells.length - 1
              ? 'var(--mark-signal, #e5531a)'
              : 'currentColor'
          }
        />
      ))}
    </svg>
  );
}
