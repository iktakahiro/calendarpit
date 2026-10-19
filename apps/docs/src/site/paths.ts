/** Resolves an unprefixed site path against the configured deployment base. */
export function sitePath(path = ''): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//u, '')}`;
}
