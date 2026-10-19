import { defineI18n } from 'fumadocs-core/i18n';

/** English at the root, Japanese under /ja/, with explicit translations. */
export const i18n = defineI18n({
  languages: ['en', 'ja'],
  defaultLanguage: 'en',
  hideLocale: 'default-locale',
  parser: 'dir',
  fallbackLanguage: null,
});

/** Reads a configured locale prefix, falling back to the unprefixed language. */
export function localeFromPath(path: string): string {
  const first = path.split('/').filter(Boolean)[0];
  return (
    i18n.languages.find((language) => language === first) ??
    i18n.defaultLanguage
  );
}
