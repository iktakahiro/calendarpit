import { Empty } from '@cloudflare/kumo/components/empty';
import { Icon, type IconName } from '../../../components/icon';
import { useMessages } from '../../../components/language';
import type { DirectoryKind } from '../models/directory-forms';

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
  kind,
  rows,
  selectedId,
  disabled,
  select,
}: {
  label: string;
  title: string;
  subtitle: string;
  icon: IconName;
  kind: DirectoryKind;
  rows: DirectoryRow[];
  selectedId?: string;
  disabled: boolean;
  select: (id: string) => void;
}) {
  const t = useMessages();
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
          title={t[`directory.${kind}.empty`]}
          description={t[`directory.${kind}.emptyDescription`]}
        />
      )}
    </section>
  );
}
