import { useEffect, useState } from 'react';

/**
 * Returns the current time, updated every `intervalMs`. The clock is an
 * external system, so the time lives in state instead of being read during
 * render.
 */
export function useNow(intervalMs = 60000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
