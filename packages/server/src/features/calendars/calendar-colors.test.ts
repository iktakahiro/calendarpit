import { describe, expect, test } from 'bun:test';
import { calendarColors, nearestCalendarColorId } from './calendar-colors';

describe('nearestCalendarColorId', () => {
  test('keeps an exact palette background', () => {
    expect(nearestCalendarColorId(calendarColors['14']!.background)).toBe('14');
  });

  test('picks the closer background', () => {
    expect(nearestCalendarColorId('#ff0000')).toBe('3');
  });
});
