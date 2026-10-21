import type { History } from '@calendarpit/server';

/** CSS class for an HTTP status family. */
export function statusClass(status: number) {
  if (status >= 500) return 'status-5xx';
  if (status >= 400) return 'status-4xx';
  if (status >= 300) return 'status-3xx';
  return 'status-2xx';
}

/** Labels a request path as Calendar or OAuth traffic. */
export function area(path: string) {
  if (path.startsWith('/calendar/')) return 'Calendar';
  if (path.startsWith('/oauth')) return 'OAuth';
  return '';
}

/** Whether a recorded request failed: a response status of 400 and above. */
export const isError = (row: History) => row.status >= 400;

/** Whether a row matches a case-insensitive query on method, path, and status. */
function matchesQuery(row: History, query: string) {
  const needle = query.trim().toLowerCase();
  return (
    !needle ||
    `${row.method} ${row.path} ${row.status}`.toLowerCase().includes(needle)
  );
}

/**
 * Returns history rows newest first, optionally only errors (status 400 and
 * above), matching a case-insensitive query against method, path, and status.
 */
export function filterHistory(
  history: History[],
  query: string,
  errorsOnly: boolean,
): History[] {
  return history
    .slice()
    .reverse()
    .filter((row) => !errorsOnly || isError(row))
    .filter((row) => matchesQuery(row, query));
}

/**
 * Counts the rows that match `query` for each status segment, so the segment
 * counts always describe what selecting the segment would show.
 */
export function countHistory(history: History[], query: string) {
  const matches = history.filter((row) => matchesQuery(row, query));
  return { all: matches.length, errors: matches.filter(isError).length };
}
