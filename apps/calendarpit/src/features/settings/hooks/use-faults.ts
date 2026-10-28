import { useQuery } from '@tanstack/react-query';
import { managementApi } from '../../../lib/management-client';
import { useWorkspaceMutation } from '../../workspace/hooks/use-workspace-mutation';
import type { Fault } from '../models/faults';

/** Reads the process-local queue, including after workspace changes. */
export const useFaults = () =>
  useQuery({
    queryKey: ['workspace', 'faults'],
    queryFn: () => managementApi<{ faults: Fault[] }>('/faults'),
  });

/** Appends a fault to the queue. */
export const useAddFault = () =>
  useWorkspaceMutation(
    (fault: Fault) => managementApi('/faults', 'PUT', fault),
    'settings.faultsAdded',
  );

/** Clears the fault queue. */
export const useClearFaults = () =>
  useWorkspaceMutation(
    () => managementApi('/faults', 'DELETE'),
    'settings.faultsCleared',
  );
