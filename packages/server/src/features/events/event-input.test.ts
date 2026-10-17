import { describe, expect, test } from 'bun:test';
import { makeEvent } from './event-input';
import { interval } from './event-time';
import { defaultFixture, parseFixture } from '../fixtures/fixture';

const timed = {
  id: 'test-event',
  summary: 'Busy',
  start: { dateTime: '2026-10-19T10:00:00+09:00' },
  end: { dateTime: '2026-10-19T11:00:00+09:00' },
};

describe('makeEvent', () => {
  test('rejects ambiguous local times and honors explicit event time zones', () => {
    const c = parseFixture(defaultFixture, 0).calendars[0]!;
    expect(() =>
      makeEvent(
        {
          start: {
            dateTime: '2026-11-01T01:30:00',
            timeZone: 'America/New_York',
          },
          end: {
            dateTime: '2026-11-01T03:00:00',
            timeZone: 'America/New_York',
          },
        },
        c,
        0,
      ),
    ).toThrow();
    const e = makeEvent(
      {
        start: { dateTime: '2026-10-19T10:00:00', timeZone: 'Asia/Tokyo' },
        end: { dateTime: '2026-10-19T11:00:00', timeZone: 'Asia/Tokyo' },
      },
      c,
      0,
    );
    expect(interval(e, c)[0]).toBe(Date.parse('2026-10-19T01:00:00Z'));
  });
  test('partial extended properties preserve other keys and null deletes a key', () => {
    const c = parseFixture(defaultFixture, 0).calendars[0]!;
    const original = makeEvent(
      {
        ...timed,
        extendedProperties: {
          private: { keep: 'yes', remove: 'old' },
          shared: { shared: 'yes' },
        },
      },
      c,
      0,
    );
    const result = makeEvent(
      { extendedProperties: { private: { remove: null, added: 'new' } } },
      c,
      1,
      original,
      true,
    );
    expect(result.extendedProperties).toEqual({
      private: { keep: 'yes', added: 'new' },
      shared: { shared: 'yes' },
    });
  });
});
