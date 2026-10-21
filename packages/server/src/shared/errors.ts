/**
 * An error that maps directly to an HTTP response.
 *
 * Route handling converts it to the Google API error envelope, or to the OAuth
 * `error`/`error_description` shape for `/oauth` endpoints. Any other thrown
 * value becomes a 500 response and is logged.
 */
export class ApiError extends Error {
  /**
   * @param status - HTTP status code of the response.
   * @param reason - Machine-readable reason, such as `notFound` or an OAuth
   * error code like `invalid_grant`.
   * @param message - Human-readable explanation returned to the client.
   * @param domain - Google error domain. Defaults to `calendarpit`. Simulated
   * Calendar quotas use `usageLimits`, matching Google's quota errors.
   * @param headers - Extra response headers, such as `Retry-After` on a quota
   * error.
   */
  constructor(
    public status: number,
    public reason: string,
    message: string,
    public domain = 'calendarpit',
    public headers?: Record<string, string>,
  ) {
    super(message);
  }
}

/**
 * Throws an {@link ApiError}. Declared as `never` so it can end a branch or
 * stand in for a value in an expression.
 *
 * @param message - Human-readable explanation returned to the client.
 * @param status - HTTP status code. Defaults to 400.
 * @param reason - Machine-readable reason. Defaults to `invalidParameter`.
 */
export function fail(
  message: string,
  status = 400,
  reason = 'invalidParameter',
): never {
  throw new ApiError(status, reason, message);
}
