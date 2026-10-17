import { Button } from '@cloudflare/kumo/components/button';
import { Input } from '@cloudflare/kumo/components/input';
import { useState } from 'react';
import { Icon } from './icon';

export type HistoryRow = {
  id: string;
  time: string;
  method: string;
  path: string;
  status: number;
  request: unknown;
  response: unknown;
  headers: unknown;
  responseHeaders: unknown;
};

function statusClass(status: number) {
  if (status >= 500) return 'status-5xx';
  if (status >= 400) return 'status-4xx';
  if (status >= 300) return 'status-3xx';
  return 'status-2xx';
}
function area(path: string) {
  if (path.startsWith('/calendar/')) return 'Calendar';
  if (path.startsWith('/oauth')) return 'OAuth';
  return '';
}

function Payload({ title, value }: { title: string; value: unknown }) {
  const [copied, setCopied] = useState(false);
  const text = JSON.stringify(value, null, 2);
  return (
    <div className='payload'>
      <div className='payload-head'>
        <h3>{title}</h3>
        <Button
          variant='ghost'
          size='sm'
          icon={<Icon name={copied ? 'check' : 'copy'} />}
          aria-label={`Copy ${title.toLowerCase()} JSON`}
          onClick={() => {
            void navigator.clipboard
              ?.writeText(text)
              .then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              })
              .catch(() => {});
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <pre>{text}</pre>
    </div>
  );
}

export function HistoryView({
  history,
  pending,
  clear,
}: {
  history: HistoryRow[];
  pending: boolean;
  clear: () => void;
}) {
  const [query, setQuery] = useState('');
  const [errorsOnly, setErrorsOnly] = useState(false);
  const needle = query.trim().toLowerCase();
  const rows = history
    .slice()
    .reverse()
    .filter((row) => !errorsOnly || row.status >= 400)
    .filter(
      (row) =>
        !needle ||
        `${row.method} ${row.path} ${row.status}`
          .toLowerCase()
          .includes(needle),
    );
  const errors = history.filter((row) => row.status >= 400).length;
  return (
    <>
      <div className='toolbar'>
        <label className='search-field'>
          <Icon name='magnifier' />
          <span className='sr-only'>Filter requests</span>
          <Input
            aria-label='Filter requests'
            type='search'
            placeholder='Filter by method, path, or status'
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className='segmented' role='group' aria-label='Request status'>
          <button
            type='button'
            aria-pressed={!errorsOnly}
            onClick={() => setErrorsOnly(false)}
          >
            All <span>{history.length}</span>
          </button>
          <button
            type='button'
            aria-pressed={errorsOnly}
            onClick={() => setErrorsOnly(true)}
          >
            Errors <span>{errors}</span>
          </button>
        </div>
        <Button
          className='toolbar-end'
          variant='secondary'
          icon={<Icon name='trash' />}
          onClick={clear}
          disabled={pending}
        >
          Clear history
        </Button>
      </div>
      <p className='toolbar-note'>
        The latest 200 protocol requests, newest first. Credentials are masked.
      </p>
      <section className='history-list' aria-label='API requests'>
        {rows.map((row) => (
          <details key={row.id}>
            <summary>
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
              <time dateTime={row.time}>
                {new Date(row.time).toLocaleTimeString('en', {
                  hour12: false,
                })}
              </time>
            </summary>
            <div className='history-detail'>
              <Payload
                title='Request'
                value={{ headers: row.headers, body: row.request }}
              />
              <Payload
                title='Response'
                value={{ headers: row.responseHeaders, body: row.response }}
              />
            </div>
          </details>
        ))}
        {!history.length && (
          <div className='empty-state'>
            <Icon name='code' />
            <h3>Waiting for your app.</h3>
            <p>Calendar and OAuth calls appear here as they arrive.</p>
          </div>
        )}
        {history.length > 0 && !rows.length && (
          <div className='empty-state compact'>
            <Icon name='magnifier' />
            <h3>No matching requests</h3>
            <p>Change the filter to see more of the log.</p>
          </div>
        )}
      </section>
    </>
  );
}
