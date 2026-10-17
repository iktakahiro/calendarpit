import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/** How long a success notice stays visible. */
const noticeMs = 5000;

type Notices = {
  /** The latest success message, or an empty string. */
  notice: string;
  /** The latest error message, or an empty string. */
  error: string;
  /** Shows a success message and clears any error. */
  succeed: (message: string) => void;
  /** Shows an error message and clears any success message. */
  fail: (error: unknown) => void;
  /** Hides the error message. */
  dismissError: () => void;
};

const NoticesContext = createContext<Notices | null>(null);

/** Provides app-wide success and error toasts. */
export function NoticesProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), noticeMs);
    return () => clearTimeout(timer);
  }, [notice]);
  const succeed = useCallback((message: string) => {
    setError('');
    setNotice(message);
  }, []);
  const fail = useCallback((value: unknown) => {
    setNotice('');
    setError(value instanceof Error ? value.message : String(value));
  }, []);
  const dismissError = useCallback(() => setError(''), []);
  const value = useMemo(
    () => ({ notice, error, succeed, fail, dismissError }),
    [notice, error, succeed, fail, dismissError],
  );
  return (
    <NoticesContext.Provider value={value}>{children}</NoticesContext.Provider>
  );
}

/**
 * Returns the app-wide notices.
 *
 * @throws Error outside {@link NoticesProvider}.
 */
export function useNotices(): Notices {
  const value = useContext(NoticesContext);
  if (!value) throw new Error('useNotices requires NoticesProvider.');
  return value;
}
