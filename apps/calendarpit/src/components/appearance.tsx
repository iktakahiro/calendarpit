import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { appearanceCookie, type Appearance } from '../lib/appearance';
import { Icon } from './icon';

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
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.dataset.mode =
        preference === 'system'
          ? media.matches
            ? 'dark'
            : 'light'
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

export function AppearanceSwitcher() {
  const context = useContext(AppearanceContext);
  if (!context)
    throw new Error('AppearanceSwitcher requires AppearanceProvider.');
  return (
    <div
      className='segmented appearance-switcher'
      role='group'
      aria-label='Appearance'
    >
      {(['light', 'dark', 'system'] as const).map((mode) => (
        <button
          key={mode}
          type='button'
          aria-label={`${mode[0]!.toUpperCase()}${mode.slice(1)} mode`}
          aria-pressed={context.preference === mode}
          title={`${mode[0]!.toUpperCase()}${mode.slice(1)} mode`}
          onClick={() => context.setPreference(mode)}
        >
          <Icon
            name={
              mode === 'light' ? 'sun' : mode === 'dark' ? 'moon' : 'display'
            }
          />
          <span>
            {mode[0]!.toUpperCase()}
            {mode.slice(1)}
          </span>
        </button>
      ))}
    </div>
  );
}
