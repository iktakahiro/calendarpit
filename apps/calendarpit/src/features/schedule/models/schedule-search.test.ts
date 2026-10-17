import { expect, test } from 'bun:test';
import { parseScheduleSearch } from './schedule-search';

test.each([
  [
    { date: '2026-10-19', event: 'new' },
    { date: '2026-10-19', event: 'new' },
  ],
  [{ date: '2026-13-45' }, { date: undefined, event: undefined }],
  [
    { date: 'tomorrow', event: '' },
    { date: undefined, event: undefined },
  ],
  [
    { date: 20261019, event: 3 },
    { date: undefined, event: undefined },
  ],
])('parses %p', (search, expected) => {
  expect(parseScheduleSearch(search)).toEqual(expected);
});
