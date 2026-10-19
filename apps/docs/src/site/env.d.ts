import 'react';

declare module 'react' {
  /** Allows custom properties such as `--rise` in inline styles. */
  interface CSSProperties {
    [property: `--${string}`]: string | number | undefined;
  }
}

declare global {
  /** Canonical origin of the static documentation deployment. */
  const __DOCS_SITE_URL__: string;
}
