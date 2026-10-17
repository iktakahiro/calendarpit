import { describe, expect, test } from 'bun:test';
import { runInNewContext } from 'node:vm';
import {
  appearanceCookie,
  appearanceScript,
  parseAppearance,
} from './appearance';

describe('appearance preference', () => {
  test.each([
    [undefined, 'system'],
    ['session=secret; appearance=dark', 'system'],
    ['calendarpit-appearance=light', 'light'],
    ['session=secret; calendarpit-appearance=%64ark', 'dark'],
    ['calendarpit-appearance=system', 'system'],
    ['calendarpit-appearance=invalid', 'system'],
    ['calendarpit-appearance=%E0%A4%A', 'system'],
  ] as const)('reads only the valid appearance from %s', (cookie, expected) => {
    expect(parseAppearance(cookie)).toBe(expected);
  });

  test('persists for a year and supports both local HTTP and HTTPS', () => {
    expect(appearanceCookie('dark', false)).toBe(
      'calendarpit-appearance=dark; Path=/; Max-Age=31536000; SameSite=Lax',
    );
    expect(appearanceCookie('system', true)).toEndWith('; Secure');
  });

  test.each([
    ['calendarpit-appearance=dark', false, 'dark'],
    ['calendarpit-appearance=light', true, 'light'],
    ['', true, 'dark'],
    ['', false, 'light'],
    ['calendarpit-appearance=system', true, 'dark'],
    ['calendarpit-appearance=%E0%A4%A', true, 'dark'],
  ])(
    'applies the initial theme before hydration for %s',
    (cookie, systemDark, expected) => {
      const document = {
        cookie,
        documentElement: { dataset: { mode: 'light' } },
      };
      runInNewContext(appearanceScript, {
        document,
        window: { matchMedia: () => ({ matches: systemDark }) },
      });
      expect(document.documentElement.dataset.mode).toBe(expected);
    },
  );
});
