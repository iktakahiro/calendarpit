/**
 * Locale paths for the documentation language menu.
 *
 * The pathname swap matches Starlight's `localizedUrl`, including the site
 * `base` (`/calendarpit`). When the target locale has no translation of the
 * current page, the option points at that locale's root instead of a fallback
 * copy of the default-locale page.
 */

/** Trailing-slash policy, the same values as Astro's `trailingSlash`. */
export type TrailingSlash = 'always' | 'never' | 'ignore';

/** One configured documentation locale. `code` is `root` for the default locale. */
export type DocsLocale = {
  code: string;
  label: string;
};

/** A language menu entry. `pathname` is the absolute path to navigate to. */
export type LanguageOption = {
  label: string;
  pathname: string;
};

/** Inputs for {@link languageChoices}. */
export type LanguageChoiceInput = {
  /** Current request pathname, including the site base. */
  pathname: string;
  /** Starlight route id (`quick-start`, `ja/quick-start`, `""` for the root home). */
  routeId: string;
  /** Starlight route locale. `undefined` for the root locale. */
  routeLocale: string | undefined;
  /** Locales in menu order. */
  locales: readonly DocsLocale[];
  /** Content entry ids that exist as real translations, not fallback routes. */
  translatedIds: readonly string[];
  /** `import.meta.env.BASE_URL`, for example `/calendarpit/`. */
  base: string;
  trailingSlash: TrailingSlash;
};

/** The menu's selected pathname and its options. */
export type LanguageChoices = {
  value: string;
  options: LanguageOption[];
};

/**
 * Pathname of the same URL in `locale`, matching Starlight's language select.
 *
 * `locale` is a locale code (`ja`) or `root` / `undefined` for the default
 * locale. The result keeps `base` and only strips a trailing slash when
 * `trailingSlash` is `never`.
 */
export function localizedPathname(
  pathname: string,
  locale: string | undefined,
  options: {
    base: string;
    localeCodes: readonly string[];
    trailingSlash: TrailingSlash;
  },
): string {
  let path = pathname;
  let target = locale === 'root' || locale === undefined ? '' : locale;
  const base = stripTrailingSlash(options.base);
  const hasBase = base.length > 0 && path.startsWith(base);
  if (hasBase) path = path.slice(base.length) || '/';
  const [, baseSegment] = path.split('/');
  const isRootHtml = baseSegment?.endsWith('.html') ?? false;
  const baseSlug = isRootHtml ? baseSegment?.slice(0, -5) : baseSegment;
  const localeCodes = new Set(options.localeCodes);
  if (baseSlug && localeCodes.has(baseSlug)) {
    if (target) path = path.replace(baseSlug, target);
    else if (isRootHtml) path = '/index.html';
    else path = path.replace(`/${baseSlug}`, '');
  } else if (target) {
    path =
      baseSegment === 'index.html' ? `/${target}.html` : `/${target}${path}`;
  }
  if (hasBase) path = base + (path.startsWith('/') ? path : `/${path}`);
  if (options.trailingSlash === 'never') path = stripTrailingSlash(path);
  if (path === '') path = '/';
  return path;
}

/**
 * Language menu options for the current page.
 *
 * The selected value is the current locale's pathname. A locale with no
 * translation of this page links to that locale's root (`/calendarpit/` or
 * `/calendarpit/ja/`).
 */
export function languageChoices(input: LanguageChoiceInput): LanguageChoices {
  const localeCodes = input.locales.map((locale) => locale.code);
  const pathOptions = {
    base: input.base,
    localeCodes,
    trailingSlash: input.trailingSlash,
  };
  const translated = new Set(input.translatedIds.map(normalizeDocId));
  const slug = pageSlug(input.routeId, input.routeLocale);
  const rootPath = `${stripTrailingSlash(input.base) || ''}/`;
  const options = input.locales.map((locale) => {
    const translatedId = docIdForLocale(slug, locale.code);
    const pathname = translated.has(translatedId)
      ? localizedPathname(input.pathname, locale.code, pathOptions)
      : localizedPathname(rootPath, locale.code, pathOptions);
    return { label: locale.label, pathname };
  });
  const currentIndex = input.locales.findIndex((locale) =>
    isCurrentLocale(locale.code, input.routeLocale),
  );
  const value =
    options[currentIndex]?.pathname ?? options[0]?.pathname ?? input.pathname;
  return { value, options };
}

/**
 * Starlight's index-slug normalization: `index` is the root page, and a
 * nested `ja/index` is the `ja` locale root.
 */
function normalizeDocId(id: string): string {
  if (id === 'index') return '';
  if (id.endsWith('/index')) return id.slice(0, -'/index'.length);
  return id;
}

/** Page slug with the locale prefix removed. The home page is `""`. */
function pageSlug(routeId: string, routeLocale: string | undefined): string {
  const id = normalizeDocId(routeId);
  if (!routeLocale || routeLocale === 'root') return id;
  if (id === routeLocale) return '';
  const prefix = `${routeLocale}/`;
  if (id.startsWith(prefix)) return id.slice(prefix.length);
  return id;
}

/** Content id of `slug` in `localeCode`. The root home page is `""`. */
function docIdForLocale(slug: string, localeCode: string): string {
  if (localeCode === 'root') return slug;
  return slug ? `${localeCode}/${slug}` : localeCode;
}

/** Whether `code` is the locale currently being rendered. */
function isCurrentLocale(
  code: string,
  routeLocale: string | undefined,
): boolean {
  if (code === 'root')
    return routeLocale === undefined || routeLocale === 'root';
  return code === routeLocale;
}

/** Remove one trailing slash, matching Starlight's path helper. */
function stripTrailingSlash(path: string): string {
  return path.endsWith('/') ? path.slice(0, -1) : path;
}
