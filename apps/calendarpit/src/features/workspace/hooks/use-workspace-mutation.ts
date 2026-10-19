import {
  useIsMutating,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import type { TextKey } from '../../../lib/messages';
import { useNotices } from '../../../lib/notices';
import { useMessages } from '../../../components/language';

/**
 * A mutation of workspace data. On success it refreshes every workspace query
 * and shows the `success` text in the current language; on failure it shows
 * the server's error.
 *
 * Callers that render an error near the action can `await mutateAsync` and
 * catch the error themselves; the toast still appears.
 */
export function useWorkspaceMutation<TInput, TResult>(
  mutationFn: (input: TInput) => Promise<TResult>,
  success: TextKey,
) {
  const t = useMessages();
  const queryClient = useQueryClient();
  const { succeed, fail } = useNotices();
  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['workspace'] });
      succeed(t[success]);
    },
    onError: fail,
  });
}

/** Whether any workspace mutation is running; conflicting actions wait. */
export const useWorkspaceBusy = () => useIsMutating() > 0;
