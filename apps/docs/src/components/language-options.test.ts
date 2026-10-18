import { describe, expect, test } from 'bun:test';
import { languageChoices, localizedPathname } from './language-options';

const locales = [
  { code: 'root', label: 'English' },
  { code: 'ja', label: '日本語' },
] as const;

const translatedIds = ['index', 'ja/index', 'quick-start', 'ja/quick-start'];

const shared = {
  locales,
  translatedIds,
  base: '/calendarpit/',
  trailingSlash: 'ignore' as const,
};

describe('localizedPathname', () => {
  test('prefixes the Japanese locale and keeps the /calendarpit base', () => {
    expect(
      localizedPathname('/calendarpit/quick-start/', 'ja', {
        base: '/calendarpit/',
        localeCodes: ['root', 'ja'],
        trailingSlash: 'ignore',
      }),
    ).toBe('/calendarpit/ja/quick-start/');
  });

  test('strips the locale prefix when returning to the root locale', () => {
    expect(
      localizedPathname('/calendarpit/ja/quick-start/', 'root', {
        base: '/calendarpit/',
        localeCodes: ['root', 'ja'],
        trailingSlash: 'ignore',
      }),
    ).toBe('/calendarpit/quick-start/');
  });
});

describe('languageChoices', () => {
  test('links a translated English page to the same Japanese page', () => {
    expect(
      languageChoices({
        ...shared,
        pathname: '/calendarpit/quick-start/',
        routeId: 'quick-start',
        routeLocale: undefined,
      }),
    ).toEqual({
      value: '/calendarpit/quick-start/',
      options: [
        { label: 'English', pathname: '/calendarpit/quick-start/' },
        { label: '日本語', pathname: '/calendarpit/ja/quick-start/' },
      ],
    });
  });

  test('links a translated Japanese page back to English', () => {
    expect(
      languageChoices({
        ...shared,
        pathname: '/calendarpit/ja/quick-start/',
        routeId: 'ja/quick-start',
        routeLocale: 'ja',
      }).options,
    ).toEqual([
      { label: 'English', pathname: '/calendarpit/quick-start/' },
      { label: '日本語', pathname: '/calendarpit/ja/quick-start/' },
    ]);
  });

  test('treats index ids as the locale homes', () => {
    expect(
      languageChoices({
        ...shared,
        pathname: '/calendarpit/',
        routeId: '',
        routeLocale: undefined,
      }).options,
    ).toEqual([
      { label: 'English', pathname: '/calendarpit/' },
      { label: '日本語', pathname: '/calendarpit/ja/' },
    ]);
  });

  test('falls back to the Japanese root when the page has no translation', () => {
    const choices = languageChoices({
      ...shared,
      pathname: '/calendarpit/only-en/',
      routeId: 'only-en',
      routeLocale: undefined,
      translatedIds: [...translatedIds, 'only-en'],
    });
    expect(choices.options[1]).toEqual({
      label: '日本語',
      pathname: '/calendarpit/ja/',
    });
    expect(choices.value).toBe('/calendarpit/only-en/');
  });

  test('falls back to the English root when Japanese has no translation', () => {
    const choices = languageChoices({
      ...shared,
      pathname: '/calendarpit/ja/only-ja/',
      routeId: 'ja/only-ja',
      routeLocale: 'ja',
      translatedIds: [...translatedIds, 'ja/only-ja'],
    });
    expect(choices.options[0]).toEqual({
      label: 'English',
      pathname: '/calendarpit/',
    });
    expect(choices.value).toBe('/calendarpit/ja/only-ja/');
  });

  test('drops trailing slashes when the site is configured to never use them', () => {
    expect(
      languageChoices({
        ...shared,
        trailingSlash: 'never',
        pathname: '/calendarpit/quick-start/',
        routeId: 'quick-start',
        routeLocale: undefined,
      }).options.map((option) => option.pathname),
    ).toEqual(['/calendarpit/quick-start', '/calendarpit/ja/quick-start']);
  });
});
