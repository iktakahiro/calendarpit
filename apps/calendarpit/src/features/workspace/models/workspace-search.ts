/** Search params shared by every workspace section. */
export type WorkspaceSearch = {
  /** Selected test user ID. Defaults to the first user. */
  user?: string;
  /** Selected calendar ID. Defaults to the user's primary calendar. */
  calendar?: string;
};

const text = (value: unknown) =>
  typeof value === 'string' && value ? value : undefined;

/** Validates raw search params, dropping anything malformed. */
export function parseWorkspaceSearch(
  search: Record<string, unknown>,
): WorkspaceSearch {
  return { user: text(search.user), calendar: text(search.calendar) };
}
