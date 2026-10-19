import { createCalendarpit, resolveDatabase } from '@calendarpit/server';
import {
  createStartHandler,
  defaultStreamHandler,
} from '@tanstack/react-start/server';
import { createServerEntry } from '@tanstack/react-start/server-entry';
import { readFixtureFile } from './cli/fixture-file';

const fixture = process.env.CALENDARPIT_CONFIG
  ? await readFixtureFile(process.env.CALENDARPIT_CONFIG)
  : undefined;
// Vite may reevaluate the SSR entry without invoking its HMR dispose handler.
const development = globalThis as typeof globalThis & {
  calendarpitDevelopmentRuntime?: ReturnType<typeof createCalendarpit>;
};
if (import.meta.env.DEV) development.calendarpitDevelopmentRuntime?.close();
const runtime = createCalendarpit({
  fixture,
  database: resolveDatabase(process.env.CALENDARPIT_DATABASE),
  allowedWatchHosts: process.env.CALENDARPIT_WATCH_HOSTS?.split(',')
    .map((host) => host.trim())
    .filter(Boolean),
});
if (import.meta.env.DEV) development.calendarpitDevelopmentRuntime = runtime;
export const close = () => runtime.close();
if (import.meta.hot) import.meta.hot.dispose(close);
console.info(
  `Calendarpit data: ${runtime.workspace.storage.path ?? ':memory:'}`,
);
const handleStartRequest = createStartHandler(defaultStreamHandler);

export default createServerEntry({
  fetch: async (request, options) =>
    (await runtime.handle(request)) ?? handleStartRequest(request, options),
});
