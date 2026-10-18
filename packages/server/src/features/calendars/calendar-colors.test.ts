import { describe, expect, test } from 'bun:test';
import {
  calendarColor,
  calendarColors,
  nearestCalendarColorId,
} from './calendar-colors';

describe('nearestCalendarColorId', () => {
  test('keeps an exact palette background', () => {
    expect(nearestCalendarColorId(calendarColors['14']!.background)).toBe('14');
  });

  test('picks the closer background', () => {
    expect(nearestCalendarColorId('#ff0000')).toBe('3');
  });
});

describe('calendarColor', () => {
  test.each(['constructor', 'toString', '__proto__'])(
    'rejects the inherited key %s',
    (id) => {
      expect(calendarColor(id)).toBeUndefined();
    },
  );
});
