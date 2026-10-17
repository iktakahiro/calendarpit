import { createFileRoute } from '@tanstack/react-router';
import { SettingsScreen } from '../../features/settings/settings-screen';
import { useSnapshot } from '../../features/workspace/hooks/use-snapshot';

export const Route = createFileRoute('/_workspace/settings')({
  component: Settings,
});

function Settings() {
  const { data: snapshot } = useSnapshot();
  return snapshot ? <SettingsScreen snapshot={snapshot} /> : null;
}
