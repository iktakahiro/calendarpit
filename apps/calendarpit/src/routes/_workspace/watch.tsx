import { createFileRoute } from '@tanstack/react-router';
import { WatchScreen } from '../../features/watch/watch-screen';
import { useSnapshot } from '../../features/workspace/hooks/use-snapshot';

export const Route = createFileRoute('/_workspace/watch')({
  component: Watch,
});

function Watch() {
  const { data: snapshot } = useSnapshot();
  return snapshot ? <WatchScreen snapshot={snapshot} /> : null;
}
