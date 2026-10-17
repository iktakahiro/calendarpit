import type { Snapshot } from '@calendarpit/server';
import { queryOptions, useQuery } from '@tanstack/react-query';
import { managementApi } from '../../../lib/management-client';

/** The workspace state query, polled so external changes appear live. */
export const snapshotQuery = queryOptions({
  queryKey: ['workspace', 'state'],
  queryFn: () => managementApi<Snapshot>('/state'),
});

/** Reads the workspace state shown across the admin UI. */
export const useSnapshot = () => useQuery(snapshotQuery);
