import { fail } from '../shared/errors';
import { secret } from '../shared/secrets';
import type { Workspace } from '../workspace/workspace';

/**
 * Reads `maxResults`, which Google limits to 1–2500. Defaults to 250.
 *
 * @throws {@link ApiError} 400 for a value outside the range.
 */
export function maxResults(url: URL) {
  const raw = url.searchParams.get('maxResults') ?? '250';
  if (!/^\d+$/.test(raw) || +raw < 1 || +raw > 2500)
    fail('maxResults must be between 1 and 2500.');
  return +raw;
}

/**
 * Pages a list with `maxResults` and `pageToken`, as Google list endpoints do.
 *
 * A page token works only with the same query and the same workspace
 * revision, because the rows are recomputed for every page.
 *
 * @returns The page's `items` and, when more rows remain, `nextPageToken`.
 * @throws {@link ApiError} 410 `invalidPageToken` for an unknown or stale token.
 */
export function paging<T>(workspace: Workspace, url: URL, rows: T[]) {
  const size = maxResults(url);
  const keyUrl = new URL(url);
  keyUrl.searchParams.delete('pageToken');
  keyUrl.searchParams.sort();
  const key = keyUrl.pathname + keyUrl.search;
  let offset = 0;
  const token = url.searchParams.get('pageToken');
  if (token) {
    const page = workspace.pages.get(token);
    if (!page || page.key !== key || page.revision !== workspace.revision)
      fail('Invalid or stale page token.', 410, 'invalidPageToken');
    offset = page.offset;
  }
  let nextPageToken: string | undefined;
  if (offset + size < rows.length) {
    nextPageToken = secret();
    if (workspace.pages.size > 1000) workspace.pages.clear();
    workspace.pages.set(nextPageToken, {
      key,
      revision: workspace.revision,
      offset: offset + size,
    });
  }
  return {
    items: rows.slice(offset, offset + size),
    ...(nextPageToken ? { nextPageToken } : {}),
  };
}
