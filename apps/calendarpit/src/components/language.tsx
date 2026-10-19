import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  languageCookie,
  type LanguagePreference,
  type Locale,
} from '../lib/locale';
import { messages, type Messages } from '../lib/messages';
import { Icon } from './icon';

const LanguageContext = createContext<{
  preference: LanguagePreference;
  locale: Locale;
  setPreference: (preference: LanguagePreference) => void;
} | null>(null);

/**
 * Provides the interface language. `systemLocale` is what the browser's
 * `Accept-Language` resolved to on the server, so `system` renders the same
 * language on the server and on hydration.
 */
export function LanguageProvider({
  initialPreference,
  systemLocale,
  children,
}: {
  initialPreference: LanguagePreference;
  systemLocale: Locale;
  children: ReactNode;
}) {
  const [preference, setPreference] = useState(initialPreference);
  const locale = preference === 'system' ? systemLocale : preference;
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return (
    <LanguageContext
      value={{
        preference,
        locale,
        setPreference: (next) => {
          document.cookie = languageCookie(
            next,
            location.protocol === 'https:',
          );
          setPreference(next);
        },
      }}
    >
      {children}
    </LanguageContext>
  );
}

/** Returns the interface locale, English outside {@link LanguageProvider}. */
export const useLocale = (): Locale =>
  useContext(LanguageContext)?.locale ?? 'en';

/** Returns the interface text for the current locale. */
export const useMessages = (): Messages => messages[useLocale()];

/** Language names, each written in its own language. */
const languageNames = { en: 'English', ja: '日本語' } as const;

/**
 * Chooses English, Japanese, or the browser's language. Each language is
 * named in itself so a reader can find theirs whatever is shown.
 *
 * @throws Error outside {@link LanguageProvider}.
 */
export function LanguageSwitcher() {
  const context = useContext(LanguageContext);
  const t = useMessages();
  if (!context) throw new Error('LanguageSwitcher requires LanguageProvider.');
  return (
    <div
      className='segmented appearance-switcher'
      role='group'
      aria-label={t['settings.language']}
    >
      {(['en', 'ja', 'system'] as const).map((option) => (
        <button
          key={option}
          type='button'
          lang={option === 'system' ? undefined : option}
          aria-label={
            option === 'system' ? t['settings.systemLanguage'] : undefined
          }
          aria-pressed={context.preference === option}
          onClick={() => context.setPreference(option)}
        >
          {option === 'system' && <Icon name='display' />}
          <span>
            {option === 'system' ? t['settings.system'] : languageNames[option]}
          </span>
        </button>
      ))}
    </div>
  );
}
