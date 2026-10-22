/** The Settings section shown by the route. Appearance is the default. */
export type SettingsTab = 'appearance' | 'developer' | 'data' | 'clients';

/** Optional Settings search state; the default tab is omitted from links. */
export type SettingsSearch = { tab?: Exclude<SettingsTab, 'appearance'> };

/** Validates the tab search parameter, falling back to Appearance. */
export function parseSettingsSearch(
  search: Record<string, unknown>,
): SettingsSearch {
  const { tab } = search;
  return {
    tab:
      tab === 'developer' || tab === 'data' || tab === 'clients'
        ? tab
        : undefined,
  };
}
