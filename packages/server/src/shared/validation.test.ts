import { describe, expect, test } from 'bun:test';
import { apiError } from '../testing/api-error';
import {
  booleanQuery,
  fields,
  id,
  instant,
  object,
  string,
  zone,
} from './validation';

describe('object', () => {
  test.each([
    ['null', null],
    ['undefined', undefined],
    ['an array', []],
    ['a string', 'text'],
    ['a number', 1],
  ])('rejects %s', (_label, value) => {
    expect(apiError(() => object(value)).message).toBe(
      'Expected a JSON object.',
    );
  });

  test('accepts a plain object', () => {
    expect(object({ a: 1 })).toEqual({ a: 1 });
  });
});

test('fields rejects the first unknown key as unsupported', () => {
  const error = apiError(() => fields({ a: 1, b: 2 }, ['a']));
  expect(error.status).toBe(400);
  expect(error.reason).toBe('unsupportedFeature');
  expect(error.message).toBe('Unsupported field: b');
});

describe('string', () => {
  test('uses the fallback only for undefined', () => {
    expect(string(undefined, 'name', 'x')).toBe('x');
    expect(() => string(null, 'name', 'x')).toThrow(
      'name must be a nonempty string.',
    );
  });

  test.each(['', '   ', 'a'.repeat(10001), 3])('rejects %p', (value) => {
    expect(() => string(value, 'name')).toThrow();
  });
});

describe('id', () => {
  test.each(['alex', 'a.b-c_d@e', 'x'.repeat(128)])('accepts %p', (value) => {
    expect(id(value)).toBe(value);
  });

  test.each(['primary', 'has space', 'slash/', 'x'.repeat(129)])(
    'rejects %p',
    (value) => {
      expect(() => id(value)).toThrow('Invalid ID.');
    },
  );

  test('generates a UUID when missing', () => {
    expect(id(undefined)).toMatch(/^[0-9a-f-]{36}$/);
  });
});

test('zone defaults to UTC and rejects unknown zones', () => {
  expect(zone(undefined)).toBe('UTC');
  expect(zone('Asia/Tokyo')).toBe('Asia/Tokyo');
  expect(() => zone('Mars/Base')).toThrow('Invalid IANA time zone.');
});

describe('instant', () => {
  test.each([
    ['2026-10-19T10:00:00Z', Date.parse('2026-10-19T10:00:00Z')],
    ['2026-10-19T10:00:00+09:00', Date.parse('2026-10-19T01:00:00Z')],
  ])('parses %s', (value, expected) => {
    expect(instant(value)).toBe(expected);
  });

  test.each(['2026-10-19T10:00:00', '2026-10-19', 'soon'])(
    'rejects %s without an offset',
    (value) => {
      expect(() => instant(value)).toThrow(
        'Expected an RFC3339 timestamp with an offset.',
      );
    },
  );
});

describe('booleanQuery', () => {
  const url = (query: string) => new URL(`http://local/?${query}`);

  test.each([
    ['', false, false],
    ['', true, true],
    ['flag=true', false, true],
    ['flag=false', true, false],
  ])('reads %p with fallback %p as %p', (query, fallback, expected) => {
    expect(booleanQuery(url(query), 'flag', fallback)).toBe(expected);
  });

  test.each(['flag=1', 'flag=TRUE', 'flag='])('rejects %p', (query) => {
    expect(() => booleanQuery(url(query), 'flag')).toThrow('Invalid flag.');
  });
});
