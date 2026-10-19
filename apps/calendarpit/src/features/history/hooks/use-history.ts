import type { History } from '@calendarpit/server';
import { queryOptions, useQuery } from '@tanstack/react-query';
import { managementApi } from '../../../lib/management-client';
import { useWorkspaceMutation } from '../../workspace/hooks/use-workspace-mutation';

/** The protocol history query, polled with the workspace state. */
export const historyQuery = queryOptions({
  queryKey: ['workspace', 'history'],
  queryFn: () => managementApi<History[]>('/history'),
});

/** Reads the recorded Calendar and OAuth requests. */
export const useHistory = () => useQuery(historyQuery);

/** Clears the protocol history. */
export const useClearHistory = () =>
  useWorkspaceMutation(
    () => managementApi('/history', 'DELETE'),
    'history.cleared',
  );
