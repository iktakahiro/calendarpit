import { Button } from '@cloudflare/kumo/components/button';
import { Collapsible } from '@cloudflare/kumo/components/collapsible';
import { Empty } from '@cloudflare/kumo/components/empty';
import { Input } from '@cloudflare/kumo/components/input';
import { useState } from 'react';
import { Icon } from '../../components/icon';
import { useLocale, useMessages } from '../../components/language';
import { formatClock } from '../../lib/format';
import { useWorkspaceBusy } from '../workspace/hooks/use-workspace-mutation';
import { Payload } from './components/payload';
import { useClearHistory, useHistory } from './hooks/use-history';
import { area, filterHistory, statusClass } from './models/history-filter';

/** The protocol log: recorded Calendar and OAuth requests from the app. */
export function HistoryScreen() {
  const { data: history = [] } = useHistory();
  const clear = useClearHistory();
  const busy = useWorkspaceBusy();
  const t = useMessages();
  const locale = useLocale();
  const [query, setQuery] = useState('');
  const [errorsOnly, setErrorsOnly] = useState(false);
  const rows = filterHistory(history, query, errorsOnly);
  const errors = history.filter((row) => row.status >= 400).length;
  return (
    <>
      <div className='toolbar'>
        <label className='search-field'>
          <Icon name='magnifier' />
          <span className='sr-only'>{t['history.filter']}</span>
          <Input
            aria-label={t['history.filter']}
            type='search'
            placeholder={t['history.filterPlaceholder']}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div
          className='segmented'
          role='group'
          aria-label={t['history.status']}
        >
          <button
            type='button'
            aria-pressed={!errorsOnly}
            onClick={() => setErrorsOnly(false)}
          >
            {t['history.all']} <span>{history.length}</span>
          </button>
          <button
            type='button'
            aria-pressed={errorsOnly}
            onClick={() => setErrorsOnly(true)}
          >
            {t['history.errors']} <span>{errors}</span>
          </button>
        </div>
        <Button
          className='toolbar-end'
          variant='secondary'
          icon={<Icon name='trash' />}
          onClick={() => clear.mutate(undefined)}
          disabled={busy}
        >
          {t['history.clear']}
        </Button>
      </div>
      <p className='toolbar-note'>{t['history.note']}</p>
      <section className='history-list' aria-label={t['history.requests']}>
        {rows.map((row) => (
          <Collapsible.Root key={row.id} className='history-row'>
            <Collapsible.Trigger className='history-summary'>
              <code className={`http-status ${statusClass(row.status)}`}>
                {row.status}
              </code>
              <b className={`http-method method-${row.method.toLowerCase()}`}>
                {row.method}
              </b>
              <span className='http-path'>{row.path}</span>
              {area(row.path) && (
                <span className='http-area'>{area(row.path)}</span>
              )}
              <time dateTime={row.time}>{formatClock(row.time, locale)}</time>
            </Collapsible.Trigger>
            <Collapsible.Panel>
              <div className='history-detail'>
                <Payload
                  title={t['history.request']}
                  copyLabel={t['history.copyRequest']}
                  value={{ headers: row.headers, body: row.request }}
                />
                <Payload
                  title={t['history.response']}
                  copyLabel={t['history.copyResponse']}
                  value={{ headers: row.responseHeaders, body: row.response }}
                />
              </div>
            </Collapsible.Panel>
          </Collapsible.Root>
        ))}
        {!history.length && (
          <Empty
            className='empty-state'
            icon={<Icon name='code' />}
            title={t['history.waiting']}
            description={t['history.waitingDescription']}
          />
        )}
        {history.length > 0 && !rows.length && (
          <Empty
            size='sm'
            className='empty-state'
            icon={<Icon name='magnifier' />}
            title={t['history.noMatches']}
            description={t['history.noMatchesDescription']}
          />
        )}
      </section>
    </>
  );
}
