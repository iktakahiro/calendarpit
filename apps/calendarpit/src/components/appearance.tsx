import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  appearanceCookie,
  LIGHT_SCHEME_QUERY,
  type Appearance,
} from '../lib/appearance';
import { Icon } from './icon';
import { useMessages } from './language';

const AppearanceContext = createContext<{
  preference: Appearance;
  setPreference: (preference: Appearance) => void;
} | null>(null);

export function AppearanceProvider({
  initialPreference,
  children,
}: {
  initialPreference: Appearance;
  children: ReactNode;
}) {
  const [preference, setPreference] = useState(initialPreference);
  useEffect(() => {
    const media = window.matchMedia(LIGHT_SCHEME_QUERY);
    const apply = () => {
      document.documentElement.dataset.mode =
        preference === 'system'
          ? media.matches
            ? 'light'
            : 'dark'
          : preference;
    };
    apply();
    if (preference !== 'system') return;
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [preference]);

  return (
    <AppearanceContext
      value={{
        preference,
        setPreference: (next) => {
          document.cookie = appearanceCookie(
            next,
            location.protocol === 'https:',
          );
          setPreference(next);
        },
      }}
    >
      {children}
    </AppearanceContext>
  );
}

/**
 * Returns the stored appearance preference and the function that changes it.
 * Throws outside `AppearanceProvider`.
 */
export function useAppearance() {
  const context = useContext(AppearanceContext);
  if (!context) throw new Error('Appearance requires AppearanceProvider.');
  return context;
}

export function AppearanceSwitcher() {
  const context = useAppearance();
  const t = useMessages();
  return (
    <div
      className='segmented appearance-switcher'
      role='group'
      aria-label={t['settings.appearance']}
    >
      {(['light', 'dark', 'system'] as const).map((mode) => (
        <button
          key={mode}
          type='button'
          aria-label={t['settings.mode'](t[`settings.${mode}`])}
          aria-pressed={context.preference === mode}
          title={t['settings.mode'](t[`settings.${mode}`])}
          onClick={() => context.setPreference(mode)}
        >
          <Icon
            name={
              mode === 'light' ? 'sun' : mode === 'dark' ? 'moon' : 'display'
            }
          />
          <span>{t[`settings.${mode}`]}</span>
        </button>
      ))}
    </div>
  );
}
