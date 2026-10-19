import { shiftDate } from './dates';

const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const offset = /^([+-])(\d{1,3})([dw]?)$/;

/** Whether `date` is a real `YYYY-MM-DD` day, so `2026-02-30` is rejected. */
function isRealDate(date: string) {
  const value = new Date(`${date}T12:00:00Z`);
  return (
    !Number.isNaN(value.getTime()) && value.toISOString().slice(0, 10) === date
  );
}

/**
 * Resolves a typed date for the "Go to date" prompt, or returns `undefined`.
 *
 * Accepts `YYYY-MM-DD`, `today`, `tomorrow`, `yesterday`, and offsets from the
 * shown date in days or weeks: `+3`, `-1`, `+2w`, `-1w`.
 */
export function parseDateQuery(
  query: string,
  { shown, today }: { shown: string; today: string },
) {
  const text = query.trim().toLowerCase();
  if (isoDate.test(text)) return isRealDate(text) ? text : undefined;
  if (text === 'today') return today;
  if (text === 'tomorrow') return shiftDate(today, 1);
  if (text === 'yesterday') return shiftDate(today, -1);
  const match = offset.exec(text);
  if (!match) return undefined;
  const days = Number(match[2]) * (match[3] === 'w' ? 7 : 1);
  return shiftDate(shown, match[1] === '-' ? -days : days);
}
