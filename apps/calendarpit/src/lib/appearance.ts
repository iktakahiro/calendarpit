export type Appearance = 'system' | 'light' | 'dark';
export const APPEARANCE_COOKIE = 'calendarpit-appearance';
const MAX_AGE = 60 * 60 * 24 * 365;

export function parseAppearance(cookieHeader?: string | null): Appearance {
  for (const cookie of cookieHeader?.split(';') ?? []) {
    const [name, ...value] = cookie.trim().split('=');
    if (name !== APPEARANCE_COOKIE) continue;
    try {
      const preference = decodeURIComponent(value.join('='));
      if (preference === 'light' || preference === 'dark') return preference;
    } catch {
      return 'system';
    }
    return 'system';
  }
  return 'system';
}

export function appearanceCookie(preference: Appearance, secure: boolean) {
  return `${APPEARANCE_COOKIE}=${preference}; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax${secure ? '; Secure' : ''}`;
}

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
    document.documentElement.dataset.mode = preference === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : preference;
  } catch {}
})();`;
