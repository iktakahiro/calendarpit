/** Calendarpit's version, reported by the health endpoint and the CLI. */
export const VERSION = '0.1.0';

/**
 * Returns the health payload of `GET /__calendarpit/health`.
 *
 * @param storage - Persistence mode of the running workspace.
 */
export function getServerStatus(storage: 'memory' | 'sqlite' = 'memory') {
  return {
    name: 'Calendarpit',
    version: VERSION,
    stage: 'mvp',
    storage,
    capabilities: { calendar: true, oauth: true, watch: true, fixtures: true },
  } as const;
}

/** The health payload. */
export type ServerStatus = ReturnType<typeof getServerStatus>;
