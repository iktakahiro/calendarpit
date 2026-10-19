import { expect, test } from 'bun:test';
import { parseDateQuery } from './date-query';

const context = { shown: '2026-10-19', today: '2026-11-02' };

test('accepts real ISO dates and rejects impossible ones', () => {
  expect(parseDateQuery('2026-10-21', context)).toBe('2026-10-21');
  expect(parseDateQuery(' 2028-02-29 ', context)).toBe('2028-02-29');
  expect(parseDateQuery('2026-02-30', context)).toBeUndefined();
  expect(parseDateQuery('2026-13-45', context)).toBeUndefined();
});

test('resolves words from today', () => {
  expect(parseDateQuery('Today', context)).toBe('2026-11-02');
  expect(parseDateQuery('tomorrow', context)).toBe('2026-11-03');
  expect(parseDateQuery('yesterday', context)).toBe('2026-11-01');
});

test('resolves offsets from the shown date, across months', () => {
  expect(parseDateQuery('+3', context)).toBe('2026-10-22');
  expect(parseDateQuery('-1', context)).toBe('2026-10-18');
  expect(parseDateQuery('+2w', context)).toBe('2026-11-02');
  expect(parseDateQuery('-3d', context)).toBe('2026-10-16');
});

test('rejects anything else', () => {
  for (const query of ['', 'next friday', '3', '+', '10/21'])
    expect(parseDateQuery(query, context)).toBeUndefined();
});
