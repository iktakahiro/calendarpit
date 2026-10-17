import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { CalendarEvent } from '@calendarpit/server';
import { DayView } from './day-view';

function event(id: string, start: string, end: string): CalendarEvent {
  return {
    id,
    calendarId: 'work',
    kind: 'calendar#event',
    summary: id,
    start: { dateTime: start },
    end: { dateTime: end },
    transparency: 'opaque',
    status: 'confirmed',
    created: start,
    updated: start,
    etag: id,
  };
}

function render(
  events: CalendarEvent[],
  date = '2026-10-19',
  timeZone = 'UTC',
) {
  return renderToStaticMarkup(
    <DayView
      calendar={{
        id: 'work',
        userId: 'alex',
        summary: 'Work',
        timeZone,
        primary: true,
      }}
      date={date}
      events={events}
      pending={false}
      open={() => {}}
      remove={() => {}}
      create={() => {}}
    />,
  );
}

function blocks(html: string) {
  return [...html.matchAll(/class="track-block [^"]*" style="([^"]*)"/g)].map(
    (match) => match[1]!,
  );
}

describe('day overview', () => {
  test('stacks overlapping events and reuses lanes at an exclusive end', () => {
    const html = render([
      event('first', '2026-10-19T10:00:00Z', '2026-10-19T11:00:00Z'),
      event('overlap', '2026-10-19T10:30:00Z', '2026-10-19T11:30:00Z'),
      event('adjacent', '2026-10-19T11:00:00Z', '2026-10-19T12:00:00Z'),
    ]);
    expect(blocks(html).map((style) => style.split(';').at(-1))).toEqual([
      'top:6px',
      'top:25px',
      'top:6px',
    ]);
  });

  test('clips a multi-day event to the selected calendar-local day', () => {
    const html = render(
      [event('trip', '2026-10-18T14:00:00Z', '2026-10-20T16:00:00Z')],
      '2026-10-19',
      'Asia/Tokyo',
    );
    expect(blocks(html)).toEqual(['left:0%;width:100%;top:6px']);
    expect(html).toContain('Oct 18');
    expect(html).toContain('Oct 21');
  });

  test('separates all-day and free events without computing busy durations', () => {
    const allDay = {
      ...event('holiday', '', ''),
      start: { date: '2026-10-19' },
      end: { date: '2026-10-20' },
    };
    const free = {
      ...event('reminder', '2026-10-19T10:00:00Z', '2026-10-19T11:00:00Z'),
      transparency: 'transparent' as const,
    };
    const html = render([allDay, free]);
    expect(html).toContain('track-chip busy');
    expect(html).toContain('track-block free');
    expect(html).toContain('1 timed and 1 all-day events');
    expect(html).toContain('1 day');
    expect(blocks(html)).toHaveLength(1);
  });

  test.each([
    [
      '2026-11-01',
      '2026-11-01T01:45:00-04:00',
      '2026-11-01T01:15:00-05:00',
      '30m',
    ],
    [
      '2026-03-08',
      '2026-03-08T01:30:00-05:00',
      '2026-03-08T03:30:00-04:00',
      '1h',
    ],
  ])(
    'avoids misleading clock-change geometry on %s',
    (date, start, end, elapsed) => {
      const html = render(
        [event('clock change', start, end)],
        date,
        'America/New_York',
      );
      expect(html).toContain('These events span a clock change.');
      expect(blocks(html)).toHaveLength(0);
      expect(html).toContain(`class="event-duration">${elapsed}</span>`);
    },
  );
});
