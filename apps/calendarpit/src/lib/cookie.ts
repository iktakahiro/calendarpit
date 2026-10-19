/**
 * Returns the decoded value of the first cookie called `name` in a `Cookie`
 * header, or `undefined` when it is missing or not valid percent-encoding.
 */
export function readCookie(
  cookieHeader: string | null | undefined,
  name: string,
) {
  for (const cookie of cookieHeader?.split(';') ?? []) {
    const [key, ...value] = cookie.trim().split('=');
    if (key !== name) continue;
    try {
      return decodeURIComponent(value.join('='));
    } catch {
      return undefined;
    }
  }
  return undefined;
}
