import { fail } from '../../shared/errors';
import type { Client } from '../../model/oauth';
import type { Workspace } from '../../workspace/workspace';
import { parseClient } from './oauth-client';
import { revokeGrant } from './oauth-operations';

/**
 * Finds an OAuth client by ID.
 *
 * @throws {@link ApiError} 404 `notFound`.
 */
export function findClient(workspace: Workspace, clientId: string): Client {
  const client = workspace.data.clients.find((c) => c.id === clientId);
  if (!client) fail('OAuth client not found.', 404, 'notFound');
  return client;
}

/**
 * Registers an OAuth client with the same rules as a fixture client. Users,
 * calendars, events, and connections stay as they are.
 *
 * @throws {@link ApiError} 400 for invalid input, or 409 `duplicate`.
 */
export function createClient(workspace: Workspace, input: unknown): Client {
  const client = parseClient(input);
  if (workspace.data.clients.some((c) => c.id === client.id))
    fail('Duplicate client ID.', 409, 'duplicate');
  workspace.data.clients.push(client);
  workspace.touch();
  return client;
}

/**
 * Updates a client's secret or redirect URIs. The ID is immutable, and an
 * omitted secret keeps the current one.
 *
 * Connections and their tokens stay valid, so a rotated secret applies to the
 * next `/oauth/token` request. Pending consent requests and unexchanged
 * authorization codes for a removed redirect URI are discarded.
 *
 * @throws {@link ApiError} 400 for invalid input or an ID change.
 */
export function updateClient(
  workspace: Workspace,
  existing: Client,
  input: Record<string, unknown>,
): Client {
  if (input.id !== undefined && input.id !== existing.id)
    fail('Client IDs are immutable.');
  const client = parseClient({ ...existing, ...input });
  Object.assign(existing, client);
  const registered = (uri: string) => client.redirectUris.includes(uri);
  for (const [nonce, consent] of workspace.consents)
    if (consent.clientId === client.id && !registered(consent.redirectUri))
      workspace.consents.delete(nonce);
  for (const [code, saved] of workspace.codes)
    if (
      workspace.grants.get(saved.grantId)?.clientId === client.id &&
      !registered(saved.redirectUri)
    )
      workspace.codes.delete(code);
  workspace.touch();
  return client;
}

/**
 * Deletes a client, revokes its connections (which also stops their watch
 * channels), and discards its pending consent requests.
 */
export function deleteClient(workspace: Workspace, existing: Client) {
  for (const g of workspace.grants.values())
    if (g.clientId === existing.id && !g.revoked) revokeGrant(workspace, g.id);
  for (const [nonce, consent] of workspace.consents)
    if (consent.clientId === existing.id) workspace.consents.delete(nonce);
  workspace.data.clients = workspace.data.clients.filter((c) => c !== existing);
  workspace.touch();
}
