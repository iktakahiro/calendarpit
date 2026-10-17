import { createFileRoute } from '@tanstack/react-router';
import { ConnectionsScreen } from '../../features/connections/connections-screen';
import { useSnapshot } from '../../features/workspace/hooks/use-snapshot';

export const Route = createFileRoute('/_workspace/connections')({
  component: Connections,
});

function Connections() {
  const { data: snapshot } = useSnapshot();
  return snapshot ? <ConnectionsScreen snapshot={snapshot} /> : null;
}
