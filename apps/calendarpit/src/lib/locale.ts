import { readCookie } from './cookie';

/** A language the admin UI is translated into. English is the default. */
export type Locale = 'en' | 'ja';

/** The language a reader chose, or `system` to follow the browser. */
export type LanguagePreference = 'system' | Locale;

/** Cookie that stores the {@link LanguagePreference}. */
export const LANGUAGE_COOKIE = 'calendarpit-language';

const MAX_AGE = 60 * 60 * 24 * 365;

const isLocale = (value: string | undefined): value is Locale =>
  value === 'en' || value === 'ja';

/**
 * Reads the language preference from a `Cookie` header. A missing, unknown,
 * or malformed value means `system`.
 */
export function parseLanguage(
  cookieHeader?: string | null,
): LanguagePreference {
  const preference = readCookie(cookieHeader, LANGUAGE_COOKIE);
  return isLocale(preference) ? preference : 'system';
}

/** Returns a `Set-Cookie`-style value that keeps `preference` for a year. */
export function languageCookie(
  preference: LanguagePreference,
  secure: boolean,
) {
  return `${LANGUAGE_COOKIE}=${preference}; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax${secure ? '; Secure' : ''}`;
}

/**
 * Picks the supported locale an `Accept-Language` header ranks highest, by
 * quality and then by order. Region subtags are ignored, so `ja-JP` means
 * `ja`. Unsupported languages, `*`, and a missing header fall back to English.
 */
export function localeFromAcceptLanguage(header?: string | null): Locale {
  const ranges = (header ?? '')
    .split(',')
    .map((part, index) => {
      const [tag = '', ...params] = part.trim().split(';');
      const q = params
        .map((param) => param.trim())
        .find((param) => param.startsWith('q='));
      const quality = q === undefined ? 1 : Number(q.slice(2));
      return {
        language: tag.trim().toLowerCase().split('-')[0],
        quality: Number.isFinite(quality) ? quality : 0,
        index,
      };
    })
    .filter((range) => range.quality > 0)
    .sort((a, b) => b.quality - a.quality || a.index - b.index);
  return ranges.map((range) => range.language).find(isLocale) ?? 'en';
}

/**
 * Resolves the locale to render: an explicit preference wins; `system` uses
 * the browser's `Accept-Language`; anything else is English.
 */
export function resolveLocale(
  preference: LanguagePreference,
  acceptLanguage?: string | null,
): Locale {
  return preference === 'system'
    ? localeFromAcceptLanguage(acceptLanguage)
    : preference;
}
