import {
  useIsMutating,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { useNotices } from '../../../lib/notices';

/**
 * A mutation of workspace data. On success it refreshes every workspace query
 * and shows `success`; on failure it shows the server's error.
 *
 * Callers that render an error near the action can `await mutateAsync` and
 * catch the error themselves; the toast still appears.
 */
export function useWorkspaceMutation<TInput, TResult>(
  mutationFn: (input: TInput) => Promise<TResult>,
  success: string | ((result: TResult) => string),
) {
  const queryClient = useQueryClient();
  const { succeed, fail } = useNotices();
  return useMutation({
    mutationFn,
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['workspace'] });
      succeed(typeof success === 'string' ? success : success(result));
    },
    onError: fail,
  });
}

/** Whether any workspace mutation is running; conflicting actions wait. */
export const useWorkspaceBusy = () => useIsMutating() > 0;
