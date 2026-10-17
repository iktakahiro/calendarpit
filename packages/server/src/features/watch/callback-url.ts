import { fail } from '../../shared/errors';

/** Hosts that are always allowed as watch callbacks. */
const loopbackHosts = ['127.0.0.1', '[::1]', 'localhost'];

/**
 * Validates a watch callback address against the host allowlist.
 *
 * Only loopback hosts are allowed unless more are configured explicitly, so a
 * local workspace cannot be used to send requests elsewhere. `localhost` is
 * delivered to `127.0.0.1`.
 *
 * @param allowedHosts - Extra hosts from `CALENDARPIT_WATCH_HOSTS`.
 * @returns The URL to deliver to.
 * @throws {@link ApiError} 400 for a non-HTTP(S) URL, embedded credentials, a
 * fragment, or a host outside the allowlist.
 */
export function callbackUrl(address: string, allowedHosts: string[] = []): URL {
  let url: URL;
  try {
    url = new URL(address);
  } catch {
    return fail('Invalid watch callback URL.');
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.hash
  )
    fail('Invalid watch callback URL.');
  if (![...loopbackHosts, ...allowedHosts].includes(url.hostname))
    fail(
      'Watch host is not allowed. Configure CALENDARPIT_WATCH_HOSTS explicitly.',
    );
  if (url.hostname === 'localhost') url.hostname = '127.0.0.1';
  return url;
}
