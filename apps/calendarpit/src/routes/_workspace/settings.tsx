import { createFileRoute } from '@tanstack/react-router';
import { SettingsScreen } from '../../features/settings/settings-screen';
import { parseSettingsSearch } from '../../features/settings/models/settings-search';
import { useSnapshot } from '../../features/workspace/hooks/use-snapshot';

export const Route = createFileRoute('/_workspace/settings')({
  validateSearch: parseSettingsSearch,
  component: Settings,
});

function Settings() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data: snapshot } = useSnapshot();
  return snapshot ? (
    <SettingsScreen
      snapshot={snapshot}
      tab={search.tab ?? 'appearance'}
      showTab={(tab) =>
        navigate({
          search: (previous) => ({
            ...previous,
            ...parseSettingsSearch({ tab }),
          }),
          resetScroll: false,
        })
      }
    />
  ) : null;
}
