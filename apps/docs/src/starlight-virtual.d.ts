/** The Starlight virtual modules this site's component overrides read. */

type StarlightTrailingSlash = 'always' | 'never' | 'ignore';

declare module 'virtual:starlight/project-context' {
  const context: {
    trailingSlash: StarlightTrailingSlash;
  };
  export default context;
}

declare module 'virtual:starlight/user-config' {
  const config: {
    isMultilingual: boolean;
    locales?: Record<string, { label: string; lang?: string } | undefined>;
  };
  export default config;
}
