import type { Messages } from '../../../lib/messages';

/** Parsed JSON or a localized syntax error. Fixture schema validation stays on the server. */
export type FixtureJsonResult =
  | { valid: true; value: unknown }
  | { valid: false; error: string };

/** Checks JSON before confirmation without exposing engine-specific parse errors. */
export function parseFixtureJson(text: string, t: Messages): FixtureJsonResult {
  try {
    const value: unknown = JSON.parse(text);
    return { valid: true, value };
  } catch {
    return { valid: false, error: t['settings.fixtureJsonError'] };
  }
}
