import { createFileRoute } from '@tanstack/react-router';
import { HistoryScreen } from '../../features/history/history-screen';

export const Route = createFileRoute('/_workspace/history')({
  component: HistoryScreen,
});
