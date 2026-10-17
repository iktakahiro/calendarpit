import { resolveSelection } from '../models/selection';
import type { WorkspaceSearch } from '../models/workspace-search';
import { useSnapshot } from './use-snapshot';

/**
 * Reads the workspace state and resolves the selected user and calendar from
 * the URL search params.
 */
export function useWorkspace(search: WorkspaceSearch) {
  const query = useSnapshot();
  return {
    query,
    snapshot: query.data,
    selection: resolveSelection(query.data, search),
  };
}
