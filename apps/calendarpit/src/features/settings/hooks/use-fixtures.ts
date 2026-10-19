import { managementApi } from '../../../lib/management-client';
import { useWorkspaceMutation } from '../../workspace/hooks/use-workspace-mutation';

/**
 * Replaces the workspace data with fixture JSON text. Invalid JSON and
 * invalid fixtures both surface as an error toast; nothing changes then.
 */
export const useLoadFixture = () =>
  useWorkspaceMutation(
    async (text: string) =>
      managementApi('/fixtures', 'POST', JSON.parse(text)),
    'settings.fixtureLoaded',
  );

/** Restores the startup fixture and clears runtime state. */
export const useResetWorkspace = () =>
  useWorkspaceMutation(
    () => managementApi('/reset', 'POST'),
    'settings.resetDone',
  );
