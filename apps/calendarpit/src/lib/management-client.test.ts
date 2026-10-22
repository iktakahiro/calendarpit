import { afterEach, expect, test } from 'bun:test';
import { managementApi, serverMessage } from './management-client';

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

const respond = (response: Response) => {
  globalThis.fetch = (async () => response) as unknown as typeof fetch;
};

test('keeps the message the server sent', async () => {
  respond(
    Response.json(
      { error: { message: 'users must be an array.' } },
      { status: 400 },
    ),
  );
  const error = await managementApi('/fixtures', 'POST', {}).catch(
    (e: unknown) => e,
  );
  expect(serverMessage(error)).toBe('users must be an array.');
});

test('has no server message for a response without one', async () => {
  respond(new Response('oops', { status: 500 }));
  const error = await managementApi('/fixtures', 'POST', {}).catch(
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(Error);
  expect((error as Error).message).toBe('HTTP 500');
  expect(serverMessage(error)).toBeUndefined();
});

test('has no server message for network errors and other values', () => {
  expect(serverMessage(new TypeError('Failed to fetch'))).toBeUndefined();
  expect(serverMessage('unexpected')).toBeUndefined();
});
