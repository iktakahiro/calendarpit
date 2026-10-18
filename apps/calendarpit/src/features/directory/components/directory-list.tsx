import { Empty } from '@cloudflare/kumo/components/empty';
import { Icon, type IconName } from '../../../components/icon';

/** One selectable row in a directory list. */
export type DirectoryRow = {
  id: string;
  name: string;
  detail: string;
  note: string;
};

/** A titled list of users or calendars; the selected row shows a check. */
export function DirectoryList({
  label,
  title,
  subtitle,
  icon,
  noun,
  rows,
  selectedId,
  disabled,
  select,
}: {
  label: string;
  title: string;
  subtitle: string;
  icon: IconName;
  noun: string;
  rows: DirectoryRow[];
  selectedId?: string;
  disabled: boolean;
  select: (id: string) => void;
}) {
  return (
    <section className='panel' aria-label={label}>
      <header className='panel-head'>
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <Icon name={icon} />
      </header>
      {rows.length ? (
        <ul className='rows entity-list'>
          {rows.map((row) => (
            <li key={row.id}>
              <button
                type='button'
                aria-pressed={selectedId === row.id}
                disabled={disabled}
                onClick={() => select(row.id)}
              >
                <span className='entity-summary'>
                  <strong>{row.name}</strong>
                  <span>{row.detail}</span>
                  {row.note && <small>{row.note}</small>}
                </span>
                <Icon name={selectedId === row.id ? 'check' : 'chevronRight'} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <Empty
          size='sm'
          className='empty-state'
          title={`No ${noun}s yet`}
          description={`Add the first ${noun} using the form.`}
        />
      )}
    </section>
  );
}
