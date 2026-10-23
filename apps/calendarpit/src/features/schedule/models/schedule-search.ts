/** Search params of the schedule section. */
export type ScheduleSearch = {
  /** Shown date, `YYYY-MM-DD`. */
  date?: string;
  /** Event open in the editor: an event ID, or `new`. */
  event?: string;
  /** Shown layout: the day track, or the week grid. */
  view?: 'day' | 'week';
  /** Start a new event takes from the week grid, `YYYY-MM-DDTHH:mm`. */
  at?: string;
};

/** The date the built-in fixture's sample event falls on. */
export const defaultDate = '2026-10-19';

/** Rejects calendar and clock overflow by round-tripping a value through UTC. */
function roundTripsUtc(value: string, suffix: string) {
  const parsed = Date.parse(`${value}${suffix}`);
  return (
    !Number.isNaN(parsed) &&
    new Date(parsed).toISOString().slice(0, value.length) === value
  );
}

/** Validates raw search params, dropping anything malformed. */
export function parseScheduleSearch(
  search: Record<string, unknown>,
): ScheduleSearch {
  const date =
    typeof search.date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(search.date) &&
    roundTripsUtc(search.date, 'T00:00:00Z')
      ? search.date
      : undefined;
  const event =
    typeof search.event === 'string' && search.event ? search.event : undefined;
  const view = search.view === 'week' ? 'week' : undefined;
  const at =
    typeof search.at === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(search.at) &&
    roundTripsUtc(search.at, ':00Z')
      ? search.at
      : undefined;
  return { date, event, view, at };
}
