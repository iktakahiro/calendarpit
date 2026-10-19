import { readCookie } from './cookie';

export type Appearance = 'system' | 'light' | 'dark';
export const APPEARANCE_COOKIE = 'calendarpit-appearance';
const MAX_AGE = 60 * 60 * 24 * 365;

export function parseAppearance(cookieHeader?: string | null): Appearance {
  const preference = readCookie(cookieHeader, APPEARANCE_COOKIE);
  return preference === 'light' || preference === 'dark'
    ? preference
    : 'system';
}

export function appearanceCookie(preference: Appearance, secure: boolean) {
  return `${APPEARANCE_COOKIE}=${preference}; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax${secure ? '; Secure' : ''}`;
}

/**
 * Media query that selects the light theme in system mode. System mode is dark
 * unless the device explicitly prefers light, so dark is also the theme when
 * the preference cannot be read.
 */
export const LIGHT_SCHEME_QUERY = '(prefers-color-scheme: light)';

// Run before styles and hydration so system mode never paints in the wrong theme.
// Only static code is embedded: request cookies are never interpolated into HTML.
export const appearanceScript = `(() => {
  try {
    const cookie = document.cookie.split(';').map(value => value.trim())
      .find(value => value.startsWith('${APPEARANCE_COOKIE}='));
    let preference = 'system';
    try {
      const value = decodeURIComponent(cookie?.slice('${APPEARANCE_COOKIE}='.length) ?? '');
      if (value === 'light' || value === 'dark') preference = value;
    } catch {}
    let light = false;
    try {
      light = window.matchMedia('${LIGHT_SCHEME_QUERY}').matches;
    } catch {}
    document.documentElement.dataset.mode = preference === 'system'
      ? (light ? 'light' : 'dark')
      : preference;
  } catch {}
})();`;
