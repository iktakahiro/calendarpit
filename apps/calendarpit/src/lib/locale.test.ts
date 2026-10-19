import { describe, expect, test } from 'bun:test';
import {
  languageCookie,
  localeFromAcceptLanguage,
  parseLanguage,
  resolveLocale,
} from './locale';

describe('language preference', () => {
  test.each([
    [undefined, 'system'],
    ['session=secret; language=ja', 'system'],
    ['calendarpit-language=ja', 'ja'],
    ['calendarpit-appearance=dark; calendarpit-language=%65n', 'en'],
    ['calendarpit-language=system', 'system'],
    ['calendarpit-language=fr', 'system'],
    ['calendarpit-language=%E0%A4%A', 'system'],
  ] as const)('reads only a supported language from %s', (cookie, expected) => {
    expect(parseLanguage(cookie)).toBe(expected);
  });

  test('persists for a year and supports both local HTTP and HTTPS', () => {
    expect(languageCookie('ja', false)).toBe(
      'calendarpit-language=ja; Path=/; Max-Age=31536000; SameSite=Lax',
    );
    expect(languageCookie('system', true)).toEndWith('; Secure');
  });
});

describe('locale resolution', () => {
  test.each([
    [undefined, 'en'],
    ['', 'en'],
    ['ja', 'ja'],
    ['ja-JP,ja;q=0.9,en;q=0.8', 'ja'],
    ['en-US,en;q=0.9,ja;q=0.8', 'en'],
    ['fr-FR,ja;q=0.5', 'ja'],
    ['en;q=0.4, JA;q=0.7', 'ja'],
    ['ja;q=0, en', 'en'],
    ['fr, de;q=0.8, *;q=0.1', 'en'],
    ['ja;q=oops, en;q=0.5', 'en'],
  ] as const)('maps Accept-Language %p to %s', (header, expected) => {
    expect(localeFromAcceptLanguage(header)).toBe(expected);
  });

  test('prefers the cookie, then Accept-Language, then English', () => {
    expect(resolveLocale('en', 'ja-JP')).toBe('en');
    expect(resolveLocale('ja', 'en-US')).toBe('ja');
    expect(resolveLocale('system', 'ja-JP')).toBe('ja');
    expect(resolveLocale('system', 'fr-FR')).toBe('en');
    expect(resolveLocale(parseLanguage(undefined), undefined)).toBe('en');
    expect(resolveLocale(parseLanguage('calendarpit-language=ja'), 'en')).toBe(
      'ja',
    );
  });
});
