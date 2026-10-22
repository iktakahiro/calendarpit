import type { Snapshot } from '@calendarpit/server';
import { managementApi } from '../../../lib/management-client';
import { useWorkspaceMutation } from '../../workspace/hooks/use-workspace-mutation';

/** Saves the Calendar API rate-limit mode on the workspace. */
export const useSetRateLimitMode = () =>
  useWorkspaceMutation(
    (mode: Snapshot['rateLimitMode']) =>
      managementApi('/rate-limit', 'PUT', { mode }),
    'settings.rateLimitSaved',
  );
