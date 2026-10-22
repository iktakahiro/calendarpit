import { managementApi } from '../../../lib/management-client';
import { useWorkspaceMutation } from '../../workspace/hooks/use-workspace-mutation';

/**
 * Replaces workspace data with parsed fixture JSON. Callers check syntax before
 * confirmation and can catch mutateAsync failures to show server errors inline.
 */
export const useLoadFixture = () =>
  useWorkspaceMutation(
    async (fixture: unknown) => managementApi('/fixtures', 'POST', fixture),
    'settings.fixtureLoaded',
  );

/** Restores the startup fixture and clears runtime state. */
export const useResetWorkspace = () =>
  useWorkspaceMutation(
    () => managementApi('/reset', 'POST'),
    'settings.resetDone',
  );
