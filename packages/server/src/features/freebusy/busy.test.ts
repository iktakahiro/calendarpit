import { describe, expect, test } from 'bun:test';
import { makeEvent } from '../events/event-input';
import { interval } from '../events/event-time';
import { defaultFixture, parseFixture } from '../fixtures/fixture';
import { busy } from './busy';

describe('busy', () => {
  test('merge overlaps, clip, exclude free/cancelled, handle DST all-day durations', () => {
    const c = parseFixture(defaultFixture, 0).calendars.find(
      (c) => c.id === 'sam-work',
    )!;
    const spring = makeEvent(
      { start: { date: '2026-03-08' }, end: { date: '2026-03-09' } },
      c,
      0,
    );
    expect(interval(spring, c)[1] - interval(spring, c)[0]).toBe(23 * 3600000);
    const fall = makeEvent(
      { start: { date: '2026-11-01' }, end: { date: '2026-11-02' } },
      c,
      0,
    );
    expect(interval(fall, c)[1] - interval(fall, c)[0]).toBe(25 * 3600000);
    const a = makeEvent(
      {
        start: { dateTime: '2026-03-08T06:00:00Z' },
        end: { dateTime: '2026-03-08T08:00:00Z' },
      },
      c,
      0,
    );
    const b = makeEvent(
      {
        start: { dateTime: '2026-03-08T07:00:00Z' },
        end: { dateTime: '2026-03-08T09:00:00Z' },
      },
      c,
      0,
    );
    expect(
      busy(
        [
          a,
          b,
          { ...spring, transparency: 'transparent' },
          { ...spring, status: 'cancelled' },
        ],
        c,
        Date.parse('2026-03-08T06:30:00Z'),
        Date.parse('2026-03-08T08:30:00Z'),
      ),
    ).toEqual([
      { start: '2026-03-08T06:30:00.000Z', end: '2026-03-08T08:30:00.000Z' },
    ]);
  });
});
