import { managementApi, segment } from '../../../lib/management-client';
import { useWorkspaceMutation } from '../../workspace/hooks/use-workspace-mutation';
import type { ClientSummary } from '../models/client-form';

/**
 * Registers a client, or updates the client with `id`. Other workspace data
 * and existing connections stay as they are.
 */
export const useSaveClient = () =>
  useWorkspaceMutation(
    ({ id, body }: { id?: string; body: Record<string, unknown> }) =>
      managementApi<ClientSummary>(
        `/clients${id ? segment(id) : ''}`,
        id ? 'PATCH' : 'POST',
        body,
      ),
    'OAuth client saved.',
  );

/** Deletes a client and revokes its connections. */
export const useDeleteClient = () =>
  useWorkspaceMutation(
    (id: string) => managementApi(`/clients${segment(id)}`, 'DELETE'),
    'OAuth client deleted.',
  );
