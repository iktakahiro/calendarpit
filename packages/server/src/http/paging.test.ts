import { describe, expect, test } from 'bun:test';
import { apiError } from '../testing/api-error';
import { testWorkspace } from '../testing/workspace';
import { maxResults, paging } from './paging';

const url = (query = '') =>
  new URL(`/calendarList${query}`, 'http://localhost');

describe('maxResults', () => {
  test.each([
    ['', 250],
    ['?maxResults=1', 1],
    ['?maxResults=2500', 2500],
    ['?maxResults=025', 25],
  ])('parses %s', (query, expected) => {
    expect(maxResults(url(query))).toBe(expected);
  });

  test.each(['', '0', '2501', '-1', '1.5', '1e2', ' 1', 'abc'])(
    'rejects invalid value %j',
    (value) => {
      const request = url();
      request.searchParams.set('maxResults', value);
      const error = apiError(() => maxResults(request));
      expect(error.status).toBe(400);
      expect(error.reason).toBe('invalidParameter');
    },
  );
});

describe('paging', () => {
  test('issues tokens only when more items remain and accepts reordered query parameters', () => {
    const { workspace } = testWorkspace();
    const rows = [1, 2, 3];
    const first = paging(workspace, url('?maxResults=2&foo=bar'), rows);
    expect(first.items).toEqual([1, 2]);
    expect(first.nextPageToken).toBeTruthy();
    const next = url('?foo=bar&maxResults=2');
    next.searchParams.set('pageToken', first.nextPageToken!);
    expect(paging(workspace, next, rows)).toEqual({ items: [3] });
    expect(paging(workspace, url(), rows)).toEqual({ items: rows });
  });

  test('rejects a token for a different query or a stale revision', () => {
    const { workspace } = testWorkspace();
    const rows = [1, 2];
    const first = paging(workspace, url('?maxResults=1'), rows);
    const wrongKey = url('?maxResults=1&other=value');
    wrongKey.searchParams.set('pageToken', first.nextPageToken!);
    const stale = url('?maxResults=1');
    stale.searchParams.set('pageToken', first.nextPageToken!);
    for (const request of [wrongKey, stale]) {
      if (request === stale) workspace.revision = crypto.randomUUID();
      const error = apiError(() => paging(workspace, request, rows));
      expect(error.status).toBe(410);
      expect(error.reason).toBe('invalidPageToken');
    }
  });

  test('clears stored pages when their count exceeds 1000 before issuing a token', () => {
    const { workspace } = testWorkspace();
    const request = url('?maxResults=1');
    const first = paging(workspace, request, [1, 2]);
    for (let i = 1; i < 1001; i++) paging(workspace, request, [1, 2]);
    expect(workspace.pages.size).toBe(1001);
    const latest = paging(workspace, request, [1, 2]);
    expect(workspace.pages.size).toBe(1);
    expect(workspace.pages.has(first.nextPageToken!)).toBe(false);
    expect(workspace.pages.has(latest.nextPageToken!)).toBe(true);
  });
});
