/** Search params of the schedule section. */
export type ScheduleSearch = {
  /** Shown date, `YYYY-MM-DD`. */
  date?: string;
  /** Event open in the editor: an event ID, or `new`. */
  event?: string;
};

/** The date the built-in fixture's sample event falls on. */
export const defaultDate = '2026-10-19';

/** Validates raw search params, dropping anything malformed. */
export function parseScheduleSearch(
  search: Record<string, unknown>,
): ScheduleSearch {
  const date =
    typeof search.date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(search.date) &&
    !Number.isNaN(Date.parse(`${search.date}T00:00:00Z`))
      ? search.date
      : undefined;
  const event =
    typeof search.event === 'string' && search.event ? search.event : undefined;
  return { date, event };
}
