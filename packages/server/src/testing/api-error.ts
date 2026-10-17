import { ApiError } from '../shared/errors';

/**
 * Runs `action` and returns the {@link ApiError} it throws, so tests can
 * assert on status and reason instead of only the message.
 *
 * @throws Error when `action` returns normally or throws something else.
 */
export function apiError(action: () => unknown): ApiError {
  try {
    action();
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error('Expected an ApiError.');
}
