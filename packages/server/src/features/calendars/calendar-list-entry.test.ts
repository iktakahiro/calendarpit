import { describe, expect, test } from 'bun:test';
import { apiError } from '../../testing/api-error';
import type { Calendar } from '../../model/directory';
import {
  calendarListEntry,
  defaultCalendarListSettings,
  writeCalendarListSettings,
} from './calendar-list-entry';

const calendar: Calendar = {
  id: 'alex-work',
  userId: 'alex',
  summary: 'Work calendar',
  timeZone: 'Asia/Tokyo',
  primary: true,
};

const defaults = defaultCalendarListSettings('alex', 'alex-work');

function write(
  input: Record<string, unknown>,
  patch: boolean,
  colorRgbFormat = false,
  current = defaults,
) {
  return writeCalendarListSettings({
    calendar,
    current,
    input,
    patch,
    colorRgbFormat,
    acceptedIds: [calendar.id, 'primary'],
  });
}

describe('writeCalendarListSettings', () => {
  test('patch keeps omitted fields and update restores defaults', () => {
    const patched = write(
      {
        summaryOverride: 'Desk',
        defaultReminders: [{ method: 'popup', minutes: 10 }],
      },
      true,
    );
    expect(patched.selected).toBe(true);
    expect(patched.colorId).toBe('1');
    expect(patched.summaryOverride).toBe('Desk');
    const replaced = write({ summaryOverride: 'Desk' }, false, false, patched);
    expect(replaced.selected).toBe(false);
    expect(replaced.hidden).toBe(false);
    expect(replaced.defaultReminders).toEqual([]);
    expect(replaced.summaryOverride).toBe('Desk');
    expect(replaced.colorId).toBe('1');
  });

  test('null clears optional fields and rejects unknown input', () => {
    const current = write(
      {
        summaryOverride: 'Desk',
        notificationSettings: {
          notifications: [{ type: 'agenda', method: 'email' }],
        },
      },
      true,
    );
    const cleared = write(
      { summaryOverride: null, notificationSettings: null },
      true,
      false,
      current,
    );
    expect(cleared.summaryOverride).toBeUndefined();
    expect(cleared.notificationSettings).toBeUndefined();
    expect(apiError(() => write({ description: 'nope' }, true)).reason).toBe(
      'unsupportedFeature',
    );
  });

  test.each([
    ['a changed summary', { summary: 'Other' }, 'summary is read-only.'],
    ['a stale etag', { etag: '"stale"' }, 'etag does not match'],
    [
      'rgb colors without the flag',
      { backgroundColor: '#ff0000' },
      'colorRgbFormat=true',
    ],
    ['an unknown color', { colorId: '25' }, 'Invalid calendar colorId.'],
    [
      'an inherited color id',
      { colorId: 'constructor' },
      'Invalid calendar colorId.',
    ],
    [
      'a sixth reminder',
      {
        defaultReminders: Array.from({ length: 6 }, () => ({
          method: 'popup',
          minutes: 5,
        })),
      },
      'At most five',
    ],
  ])('rejects %s', (_name, input, message) => {
    expect(apiError(() => write(input, true)).message).toContain(message);
  });

  test('colorRgbFormat stores both colors and ignores a stale colorId', () => {
    const next = write(
      {
        colorId: '1',
        backgroundColor: '#FF0000',
        foregroundColor: '#ffffff',
      },
      true,
      true,
    );
    expect(next.colorId).toBe('3');
    expect(next.backgroundColor).toBe('#ff0000');
    expect(next.foregroundColor).toBe('#ffffff');
    const entry = calendarListEntry(calendar, next);
    expect(entry.backgroundColor).toBe('#ff0000');
    expect(entry.etag).toBe(calendarListEntry(calendar, next).etag);
    const echoed = write(
      {
        colorId: entry.colorId,
        backgroundColor: entry.backgroundColor,
        foregroundColor: entry.foregroundColor,
        summaryOverride: 'Desk',
      },
      true,
      false,
      next,
    );
    expect(echoed.backgroundColor).toBe('#ff0000');
    expect(echoed.colorId).toBe('3');
    expect(echoed.summaryOverride).toBe('Desk');
  });

  test('an empty notificationSettings object leaves the array unchanged', () => {
    const current = write(
      {
        notificationSettings: {
          notifications: [{ type: 'agenda', method: 'email' }],
        },
      },
      true,
    );
    const kept = write({ notificationSettings: {} }, true, false, current);
    expect(kept.notificationSettings).toEqual(current.notificationSettings);
    const cleared = write(
      { notificationSettings: { notifications: [] } },
      true,
      false,
      current,
    );
    expect(cleared.notificationSettings).toBeUndefined();
    const replaced = write({ notificationSettings: {} }, false, false, current);
    expect(replaced.notificationSettings).toBeUndefined();
  });
});
