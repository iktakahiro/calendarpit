/** Keys whose values are secrets in headers, bodies, and query strings. */
const sensitive =
  /^(authorization|cookie|set-cookie|client_secret|secret|access_token|refresh_token|id_token|code|code_verifier|code_challenge|consent|token|x-goog-channel-token|state)$/i;

/** OAuth authorization code key, which Google error bodies reuse for numbers. */
const codeKey = /^code$/i;

/** Strings longer than this are truncated in history records. */
const maxStringLength = 12000;

/**
 * Deep-copies a JSON-like value, replacing secret values with `[REDACTED]` and
 * truncating long strings. Protocol history passes through this before it is
 * stored or shown.
 *
 * A `code` key is kept only when its value is a number: Google API error
 * bodies carry a numeric `error.code` such as `403`. OAuth authorization codes
 * are always strings, so they stay redacted.
 */
export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, v]) => [
        key,
        sensitive.test(key) && !(codeKey.test(key) && typeof v === 'number')
          ? '[REDACTED]'
          : redact(v),
      ]),
    );
  if (typeof value === 'string' && value.length > maxStringLength)
    return value.slice(0, maxStringLength) + ' [truncated]';
  return value;
}

/**
 * Redacts secret query parameters and URL credentials. Relative paths stay
 * relative. Query values are strings, so `code` is always redacted here.
 *
 * @returns The safe URL, or `[invalid URL]` when it cannot be parsed.
 */
export function safeUrl(value: string) {
  try {
    const url = new URL(value, 'http://local');
    for (const key of [...url.searchParams.keys()])
      if (sensitive.test(key)) url.searchParams.set(key, '[REDACTED]');
    url.username = '';
    url.password = '';
    return value.startsWith('/') ? url.pathname + url.search : url.href;
  } catch {
    return '[invalid URL]';
  }
}

/**
 * Converts headers to a redacted object. `Location` and `Referer` are treated
 * as URLs, because OAuth codes and state travel in their query strings.
 */
export function redactHeaders(value: Headers) {
  return redact(
    Object.fromEntries(
      [...value].map(([key, v]) => [
        key,
        ['location', 'referer'].includes(key) ? safeUrl(v) : v,
      ]),
    ),
  );
}
