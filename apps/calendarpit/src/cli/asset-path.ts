/** Converts a build-relative asset filename into its HTTP pathname on every OS. */
export function assetPath(filename: string) {
  return `/${filename.replaceAll('\\', '/').split('/').map(encodeURIComponent).join('/')}`;
}
