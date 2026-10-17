import { Temporal } from '@js-temporal/polyfill';
import { fail } from './errors';

/**
 * Narrows a parsed JSON value to a plain object.
 *
 * @throws {@link ApiError} 400 when the value is null, an array, or a primitive.
 */
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    fail('Expected a JSON object.');
  return value as Record<string, unknown>;
}

/**
 * Rejects fields outside an allowlist. Calendarpit refuses unknown input
 * instead of ignoring it, so clients notice unsupported Google features.
 *
 * @throws {@link ApiError} 400 `unsupportedFeature` naming the first unknown field.
 */
export function fields(value: Record<string, unknown>, allowed: string[]) {
  for (const key of Object.keys(value))
    if (!allowed.includes(key))
      fail(`Unsupported field: ${key}`, 400, 'unsupportedFeature');
}

/**
 * Reads a nonempty string of at most 10,000 characters.
 *
 * @param name - Field name used in the error message.
 * @param fallback - Value returned when `value` is undefined. Without it, a
 * missing value is an error.
 * @throws {@link ApiError} 400 when the value is missing, blank, or too long.
 */
export function string(
  value: unknown,
  name: string,
  fallback?: string,
): string {
  if (value === undefined && fallback !== undefined) return fallback;
  if (typeof value !== 'string' || !value.trim() || value.length > 10000)
    fail(`${name} must be a nonempty string.`);
  return value;
}

/**
 * Reads a resource ID: 1–128 characters from `[a-zA-Z0-9@._-]`. The word
 * `primary` is reserved because Google uses it as a calendar alias.
 *
 * @param fallback - ID used when `value` is undefined. Defaults to a new UUID.
 * @throws {@link ApiError} 400 when the ID is malformed or reserved.
 */
export function id(value: unknown, fallback = crypto.randomUUID()): string {
  const result = string(value, 'id', fallback);
  if (!/^[a-zA-Z0-9@._-]{1,128}$/.test(result) || result === 'primary')
    fail('Invalid ID.');
  return result;
}

/**
 * Reads an IANA time zone name. A missing value means `UTC`.
 *
 * @throws {@link ApiError} 400 when the runtime does not recognize the zone.
 */
export function zone(value: unknown): string {
  const result = string(value, 'timeZone', 'UTC');
  try {
    new Intl.DateTimeFormat('en', { timeZone: result });
  } catch {
    fail('Invalid IANA time zone.');
  }
  return result;
}

/**
 * Parses an RFC 3339 timestamp that includes an offset or `Z`.
 *
 * @returns Epoch milliseconds.
 * @throws {@link ApiError} 400 for a local time without an offset or any
 * malformed value.
 */
export function instant(value: unknown): number {
  try {
    return Temporal.Instant.from(string(value, 'timestamp')).epochMilliseconds;
  } catch {
    return fail('Expected an RFC3339 timestamp with an offset.');
  }
}

/**
 * Reads a boolean query parameter. Only the literals `true` and `false` count.
 *
 * @param fallback - Value used when the parameter is absent.
 * @throws {@link ApiError} 400 for any other value.
 */
export function booleanQuery(url: URL, key: string, fallback = false) {
  const value = url.searchParams.get(key);
  if (value === null) return fallback;
  if (value !== 'true' && value !== 'false') fail(`Invalid ${key}.`);
  return value === 'true';
}
