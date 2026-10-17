import { fail } from '../../shared/errors';
import type { CalendarEvent } from '../../model/event';
import type { Workspace } from '../../workspace/workspace';

/** Event page tokens expire after one hour. */
const pageTtlMs = 3600000;
/** At most this many frozen pages are kept; the oldest are dropped first. */
const maxPages = 1000;

/**
 * Pages an event list. Unlike other lists, the remaining rows are frozen when
 * the first page is served, so later pages are stable under concurrent writes.
 * The sync token travels with the frozen rows and appears on the last page.
 *
 * @param size - Page size from `maxResults`.
 * @param userId - Binds page tokens to the caller.
 * @param syncToken - Token to return on the last page.
 * @throws {@link ApiError} 410 `invalidPageToken` for an unknown, expired, or
 * mismatched page token.
 */
export function eventPage(
  workspace: Workspace,
  url: URL,
  size: number,
  userId: string,
  rows: CalendarEvent[],
  syncToken?: string,
) {
  const keyUrl = new URL(url);
  keyUrl.searchParams.delete('pageToken');
  keyUrl.searchParams.set('_user', userId);
  keyUrl.searchParams.sort();
  const key = keyUrl.pathname + keyUrl.search;
  const pageToken = url.searchParams.get('pageToken');
  let offset = 0;
  if (pageToken) {
    const page = workspace.eventPages.get(pageToken);
    if (!page || page.key !== key || page.expires <= workspace.now())
      fail('Invalid or expired page token.', 410, 'invalidPageToken');
    rows = page.rows;
    offset = page.offset;
    syncToken = page.syncToken;
  }
  let nextPageToken: string | undefined;
  if (offset + size < rows.length) {
    nextPageToken = crypto.randomUUID();
    while (workspace.eventPages.size >= maxPages)
      workspace.eventPages.delete(workspace.eventPages.keys().next().value!);
    workspace.eventPages.set(nextPageToken, {
      key,
      rows: structuredClone(rows),
      offset: offset + size,
      syncToken,
      expires: workspace.now() + pageTtlMs,
    });
  }
  return {
    items: rows.slice(offset, offset + size),
    ...(nextPageToken
      ? { nextPageToken }
      : syncToken
        ? { nextSyncToken: syncToken }
        : {}),
  };
}
