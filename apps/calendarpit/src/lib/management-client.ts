/** Base path of the management API served by `@calendarpit/server`. */
const base = '/__calendarpit';

/** HTTP methods the management API uses. */
type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

/** A failed management API call, carrying the server's message. */
export class ManagementError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/**
 * Calls the management API. Writes send JSON, which the server requires for
 * every non-GET request.
 *
 * @param path - Path below `/__calendarpit`, such as `/state`.
 * @returns The parsed JSON body, or `undefined` for 204 responses.
 * @throws {@link ManagementError} with the server's error message.
 */
export async function managementApi<T>(
  path: string,
  method: Method = 'GET',
  body?: unknown,
): Promise<T> {
  const response = await fetch(base + path, {
    method,
    headers: method === 'GET' ? {} : { 'Content-Type': 'application/json' },
    body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as {
      error?: { message?: string };
    };
    throw new ManagementError(
      data.error?.message ?? `HTTP ${response.status}`,
      response.status,
    );
  }
  return response.status === 204 ? (undefined as T) : response.json();
}

/** Encodes an ID for use as one path segment. */
export const segment = (id: string) => `/${encodeURIComponent(id)}`;
