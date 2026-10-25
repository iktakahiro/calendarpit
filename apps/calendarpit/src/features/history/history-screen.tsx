import { Button } from '@cloudflare/kumo/components/button';
import { Collapsible } from '@cloudflare/kumo/components/collapsible';
import { Empty } from '@cloudflare/kumo/components/empty';
import { Input } from '@cloudflare/kumo/components/input';
import { useEffect, useRef, useState } from 'react';
import { ConfirmButton } from '../../components/confirm-button';
import { Icon } from '../../components/icon';
import { useLocale, useMessages } from '../../components/language';
import { formatClock, formatTimestamp } from '../../lib/format';
import { useWorkspaceBusy } from '../workspace/hooks/use-workspace-mutation';
import { Payload } from './components/payload';
import { useClearHistory, useHistory } from './hooks/use-history';
import {
  area,
  countHistory,
  filterHistory,
  statusClass,
} from './models/history-filter';

/** The protocol log: recorded Calendar and OAuth requests from the app. */
export function HistoryScreen() {
  const historyQuery = useHistory();
  const history = historyQuery.data ?? [];
  const clear = useClearHistory();
  const busy = useWorkspaceBusy();
  const t = useMessages();
  const locale = useLocale();
  const [query, setQuery] = useState('');
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const hasData = historyQuery.data !== undefined;
  // Keep the error and retry action visible while a refetch resets the query
  // to pending without data, including retries triggered by polling.
  const loadFailed = !hasData && historyQuery.errorUpdateCount > 0;
  // Only a retry from the button disables it, so background polling never
  // takes focus away from it.
  const [retrying, setRetrying] = useState(false);
  const retryRef = useRef<HTMLButtonElement>(null);
  const retryHadFocus = useRef(false);
  // Disabling the retry button can drop focus; restore it after a failed retry.
  useEffect(() => {
    if (retrying || !retryHadFocus.current) return;
    retryHadFocus.current = false;
    if (document.activeElement === document.body) retryRef.current?.focus();
  }, [retrying]);
  const rows = filterHistory(history, query, errorsOnly);
  const counts = countHistory(history, query);
  const filtering = errorsOnly || query.trim() !== '';
  // The live region changes only here, on user input. New requests arrive
  // through the change stream, and announcing each one would be noise.
  const applyFilters = (nextQuery: string, nextErrorsOnly: boolean) => {
    setQuery(nextQuery);
    setErrorsOnly(nextErrorsOnly);
    setAnnouncement(
      nextErrorsOnly || nextQuery.trim() !== ''
        ? t['history.matches'](
            filterHistory(history, nextQuery, nextErrorsOnly).length,
          )
        : '',
    );
  };
  const clearFilters = () => applyFilters('', false);
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
            onChange={(e) => applyFilters(e.target.value, errorsOnly)}
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
            onClick={() => applyFilters(query, false)}
          >
            {t['history.all']} <span>{counts.all}</span>
          </button>
          <button
            type='button'
            aria-pressed={errorsOnly}
            onClick={() => applyFilters(query, true)}
          >
            {t['history.errors']} <span>{counts.errors}</span>
          </button>
        </div>
        <ConfirmButton
          className='toolbar-end'
          label={t['history.clear']}
          icon={<Icon name='trash' />}
          disabled={busy || !history.length}
          title={t['history.clearTitle']}
          description={t['history.clearDescription']}
          confirmLabel={t['history.clear']}
          confirm={() => clear.mutate(undefined)}
        />
      </div>
      <p className='toolbar-note'>
        {filtering && history.length
          ? t['history.showing'](rows.length, history.length)
          : t['history.note']}
      </p>
      <p className='sr-only' role='status'>
        {announcement}
      </p>
      <section className='history-list' aria-label={t['history.requests']}>
        {loadFailed ? (
          <div role='alert'>
            <Empty
              className='empty-state'
              icon={<Icon name='circleXmark' />}
              title={t['history.loadErrorTitle']}
              description={t['shell.loadErrorDescription']}
              contents={
                <Button
                  ref={retryRef}
                  variant='primary'
                  icon={<Icon name='arrowRotateRight' />}
                  loading={retrying}
                  onClick={(event) => {
                    retryHadFocus.current =
                      document.activeElement === event.currentTarget;
                    setRetrying(true);
                    void historyQuery
                      .refetch()
                      .finally(() => setRetrying(false));
                  }}
                >
                  {t['shell.tryAgain']}
                </Button>
              }
            />
          </div>
        ) : !hasData ? (
          <div className='loading' role='status'>
            <span className='live-dot' aria-hidden='true' />
            {t['history.loading']}
          </div>
        ) : null}
        {rows.length > 0 && (
          // Safari VoiceOver drops list semantics when list-style is none.
          <ol className='history-rows' role='list'>
            {rows.map((row) => (
              <Collapsible.Root
                key={row.id}
                className='history-row'
                render={<li />}
              >
                <Collapsible.Trigger className='history-summary'>
                  <code className={`http-status ${statusClass(row.status)}`}>
                    {row.status}
                  </code>
                  <b
                    className={`http-method method-${row.method.toLowerCase()}`}
                  >
                    {row.method}
                  </b>
                  <span className='http-path'>{row.path}</span>
                  {area(row.path) && (
                    <span className='http-area'>{area(row.path)}</span>
                  )}
                  <time
                    dateTime={row.time}
                    title={formatTimestamp(row.time, locale)}
                  >
                    {formatClock(row.time, locale)}
                  </time>
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
                      value={{
                        headers: row.responseHeaders,
                        body: row.response,
                      }}
                    />
                  </div>
                </Collapsible.Panel>
              </Collapsible.Root>
            ))}
          </ol>
        )}
        {hasData && !history.length && (
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
            contents={
              <Button variant='secondary' onClick={clearFilters}>
                {t['history.clearFilters']}
              </Button>
            }
          />
        )}
      </section>
    </>
  );
}
