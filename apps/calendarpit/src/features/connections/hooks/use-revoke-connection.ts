import { managementApi, segment } from '../../../lib/management-client';
import { useWorkspaceMutation } from '../../workspace/hooks/use-workspace-mutation';

/** Revokes a connection, which also stops its watch channels. */
export const useRevokeConnection = () =>
  useWorkspaceMutation(
    (grantId: string) =>
      managementApi(`/connections${segment(grantId)}/revoke`, 'POST'),
    'Connection revoked. Reconnect from your app.',
  );
