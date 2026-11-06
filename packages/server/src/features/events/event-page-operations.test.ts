import { describe, expect, test } from 'bun:test';
import { apiError } from '../../testing/api-error';
import { calendarIn, eventIn } from '../../testing/records';
import { testWorkspace } from '../../testing/workspace';
import { eventPage } from './event-page-operations';

const url = () =>
  new URL('/calendars/calendar/events?maxResults=1', 'http://localhost');
const nextUrl = (token: string) => {
  const request = url();
  request.searchParams.set('pageToken', token);
  return request;
};
const event = (id: string) =>
  eventIn(calendarIn('UTC'), {
    id,
    summary: id,
    start: { date: '2026-10-19' },
    end: { date: '2026-10-20' },
  });

function pageToken(page: ReturnType<typeof eventPage>) {
  if (!('nextPageToken' in page)) throw new Error('Expected a page token.');
  return page.nextPageToken;
}

describe('eventPage', () => {
  test('freezes remaining rows and returns the original sync token only on the last page', () => {
    const { workspace } = testWorkspace();
    const rows = [event('a'), event('b'), event('c')];
    const first = eventPage(
      workspace,
      url(),
      1,
      'owner',
      rows,
      'sync-original',
    );
    expect(first.items.map((item) => item.summary)).toEqual(['a']);
    expect(pageToken(first)).toBeTruthy();
    expect('nextSyncToken' in first).toBe(false);
    rows[1]!.summary = 'changed';
    rows.splice(2, 1, event('new'));
    workspace.revision = crypto.randomUUID();
    const second = eventPage(
      workspace,
      nextUrl(pageToken(first)),
      1,
      'owner',
      rows,
      'sync-new',
    );
    expect(second.items.map((item) => item.summary)).toEqual(['b']);
    expect(pageToken(second)).toBeTruthy();
    expect('nextSyncToken' in second).toBe(false);
    const last = eventPage(
      workspace,
      nextUrl(pageToken(second)),
      1,
      'owner',
      [],
      'sync-new',
    );
    expect(last.items.map((item) => item.summary)).toEqual(['c']);
    expect('nextPageToken' in last).toBe(false);
    expect(last).toHaveProperty('nextSyncToken', 'sync-original');
  });

  test('expires tokens at one hour and binds them to the user', () => {
    const { workspace, clock } = testWorkspace();
    const rows = [event('a'), event('b')];
    const first = eventPage(workspace, url(), 1, 'owner', rows);
    const request = nextUrl(pageToken(first));
    const wrongUser = apiError(() =>
      eventPage(workspace, request, 1, 'other', rows),
    );
    expect([wrongUser.status, wrongUser.reason]).toEqual([
      410,
      'invalidPageToken',
    ]);
    clock.now += 3600000 - 1;
    expect(
      eventPage(workspace, request, 1, 'owner', []).items[0]?.summary,
    ).toBe('b');
    clock.now += 1;
    const expired = apiError(() =>
      eventPage(workspace, request, 1, 'owner', rows),
    );
    expect([expired.status, expired.reason]).toEqual([410, 'invalidPageToken']);
  });

  test('evicts the oldest token when the page limit is reached', () => {
    const { workspace } = testWorkspace();
    const rows = [event('a'), event('b')];
    const first = eventPage(workspace, url(), 1, 'owner', rows);
    for (let i = 1; i < 1000; i++)
      eventPage(workspace, url(), 1, 'owner', rows);
    expect(workspace.eventPages.size).toBe(1000);
    const latest = eventPage(workspace, url(), 1, 'owner', rows);
    expect(workspace.eventPages.size).toBe(1000);
    const error = apiError(() =>
      eventPage(workspace, nextUrl(pageToken(first)), 1, 'owner', rows),
    );
    expect([error.status, error.reason]).toEqual([410, 'invalidPageToken']);
    expect(
      eventPage(workspace, nextUrl(pageToken(latest)), 1, 'owner', []).items[0]
        ?.summary,
    ).toBe('b');
  });
});
