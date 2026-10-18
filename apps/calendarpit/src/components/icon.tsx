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
