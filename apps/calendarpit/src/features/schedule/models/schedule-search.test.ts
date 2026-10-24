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

test.each([
  ['2026-02-28', '2026-02-28'],
  ['2028-02-29', '2028-02-29'],
  ['2026-02-29', undefined],
  ['2026-02-31', undefined],
  ['2026-04-31', undefined],
  ['2026-00-19', undefined],
  ['2026-10-00', undefined],
])('round-trips the date %p', (date, expected) => {
  expect(parseScheduleSearch({ date }).date).toBe(expected);
});

test.each([
  ['2026-10-19T00:00', '2026-10-19T00:00'],
  ['2026-10-19T23:59', '2026-10-19T23:59'],
  ['2028-02-29T12:30', '2028-02-29T12:30'],
  ['2026-02-29T12:30', undefined],
  ['2026-02-31T12:30', undefined],
  ['2026-04-31T12:30', undefined],
  ['2026-13-19T12:30', undefined],
  ['2026-10-00T12:30', undefined],
  ['2026-10-19T24:00', undefined],
  ['2026-10-19T25:00', undefined],
  ['2026-10-19T23:60', undefined],
  ['2026-10-19T-1:00', undefined],
  ['2026-10-19T1:00', undefined],
  ['2026-10-19T12:30Z', undefined],
  ['2026-10-19T12:30:00', undefined],
  ['tomorrow', undefined],
  [20261019, undefined],
])('round-trips the event start %p', (at, expected) => {
  expect(parseScheduleSearch({ at }).at).toBe(expected);
});

test('drops invalid dates without losing the other schedule params', () => {
  expect(
    parseScheduleSearch({
      date: '2026-02-31',
      at: '2026-02-31T12:30',
      view: 'week',
      event: 'new',
    }),
  ).toEqual({ date: undefined, at: undefined, view: 'week', event: 'new' });
});
