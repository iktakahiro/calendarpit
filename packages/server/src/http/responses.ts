import { ApiError } from '../shared/errors';

/** Returns a JSON response that clients must not cache. */
export const json = (value: unknown, status = 200) =>
  Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });

/** Returns an empty 204 response. */
export const noContent = () => new Response(null, { status: 204 });

/**
 * Converts a thrown value into an error response.
 *
 * {@link ApiError} keeps its status and reason. A `URIError` from decoding a
 * path segment becomes a 400. Anything else is logged and becomes a 500 with
 * no internal detail.
 *
 * @param oauth - Use the OAuth `error`/`error_description` body instead of the
 * Google API error envelope.
 */
export function errorResponse(error: unknown, oauth: boolean) {
  const e =
    error instanceof ApiError
      ? error
      : error instanceof URIError
        ? new ApiError(400, 'invalidParameter', 'Invalid URL encoding.')
        : new ApiError(500, 'internalError', 'Internal server error.');
  if (!(error instanceof ApiError)) console.error(error);
  const response = oauth
    ? json({ error: e.reason, error_description: e.message }, e.status)
    : json(
        {
          error: {
            code: e.status,
            message: e.message,
            errors: [
              { domain: e.domain, reason: e.reason, message: e.message },
            ],
          },
        },
        e.status,
      );
  if (e.status === 401) response.headers.set('WWW-Authenticate', 'Bearer');
  if (e.headers)
    for (const [name, value] of Object.entries(e.headers))
      response.headers.set(name, value);
  return response;
}
