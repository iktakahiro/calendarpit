/** Calendarpit's version, reported by the health endpoint and the CLI. */
export const VERSION = '0.1.0';

/**
 * Release stage reported by the health endpoint. `preview` means the documented
 * scope works and the API surface may still change before 1.0.
 */
const STAGE = 'preview';

/**
 * Returns the health payload of `GET /__calendarpit/health`.
 *
 * @param storage - Persistence mode of the running workspace.
 */
export function getServerStatus(storage: 'memory' | 'sqlite' = 'memory') {
  return {
    name: 'Calendarpit',
    version: VERSION,
    stage: STAGE,
    storage,
    capabilities: { calendar: true, oauth: true, watch: true, fixtures: true },
  } as const;
}

/** The health payload. */
export type ServerStatus = ReturnType<typeof getServerStatus>;
