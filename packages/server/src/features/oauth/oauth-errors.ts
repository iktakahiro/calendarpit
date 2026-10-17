import { ApiError } from '../../shared/errors';

/**
 * Throws an OAuth 2.0 error. The response body becomes
 * `{ error, error_description }` with status 400.
 *
 * @param error - RFC 6749 error code, such as `invalid_grant`.
 */
export function oauthError(error: string, message: string): never {
  throw new ApiError(400, error, message);
}
