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

/** The Calendarpit mark: a day page with one scheduled block. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden='true'
      className={className}
      viewBox='0 0 40 40'
      xmlns='http://www.w3.org/2000/svg'
    >
      <rect width='40' height='40' rx='10' fill='currentColor' />
      <path
        d='M10 12.5h20'
        stroke='var(--mark-paper, #f2f1ec)'
        strokeWidth='2.5'
        strokeLinecap='round'
      />
      <rect
        x='10'
        y='17.5'
        width='9'
        height='12.5'
        rx='2'
        fill='var(--mark-signal, #e5531a)'
      />
      <path
        d='M23.5 19h6.5M23.5 24h6.5M23.5 29h3.5'
        stroke='var(--mark-paper, #f2f1ec)'
        strokeOpacity='.6'
        strokeWidth='2'
        strokeLinecap='round'
      />
    </svg>
  );
}
