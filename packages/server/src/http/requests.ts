import { ApiError, fail } from '../shared/errors';
import { object } from '../shared/validation';

/** Largest accepted request body, in bytes. */
export const maxBodyBytes = 1048576;

/**
 * Reads the request body as UTF-8 text, enforcing {@link maxBodyBytes} while
 * streaming so an oversized body is never fully buffered.
 *
 * @throws {@link ApiError} 413 `payloadTooLarge`.
 */
export async function readBody(request: Request) {
  if (Number(request.headers.get('content-length')) > maxBodyBytes)
    fail('Request body too large.', 413, 'payloadTooLarge');
  const reader = request.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.length;
      if (length > maxBodyBytes) {
        await reader.cancel();
        fail('Request body too large.', 413, 'payloadTooLarge');
      }
      chunks.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * Parses a body that must be a JSON object.
 *
 * @throws {@link ApiError} 400 for invalid JSON or a non-object value.
 */
export function parseJsonBody(text: string) {
  try {
    return object(JSON.parse(text));
  } catch (e) {
    if (e instanceof ApiError) throw e;
    return fail('Invalid JSON body.');
  }
}

/**
 * Blocks cross-site requests to endpoints that change local state, such as
 * the management API and the consent form.
 *
 * @throws {@link ApiError} 403 `forbidden`.
 */
export function requireSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (
    (origin && origin !== new URL(request.url).origin) ||
    request.headers.get('sec-fetch-site') === 'cross-site'
  )
    fail('Cross-origin management requests are not allowed.', 403, 'forbidden');
}

/** Google's system parameters, accepted on every endpoint. */
const systemParameters = ['alt', 'prettyPrint', 'quotaUser', 'key'];

/**
 * Rejects query parameters outside an allowlist, so unsupported Google
 * options fail loudly. Only `alt=json` is accepted.
 *
 * @throws {@link ApiError} 400 `unsupportedFeature` for an unknown parameter.
 */
export function checkQuery(url: URL, allowed: string[]) {
  for (const key of url.searchParams.keys())
    if (![...allowed, ...systemParameters].includes(key))
      fail(`Unsupported query parameter: ${key}`, 400, 'unsupportedFeature');
  if (url.searchParams.has('alt') && url.searchParams.get('alt') !== 'json')
    fail('Only JSON responses are supported.');
}
