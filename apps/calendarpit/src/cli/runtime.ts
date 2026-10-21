import { VERSION } from '@calendarpit/server';
import type { BunFile } from 'bun';
import { parseOptions } from './options';

export type Application = {
  fetch: (request: Request) => Response | Promise<Response>;
  assets: ReadonlyMap<string, BunFile>;
  close?: () => void;
};

export function createHandler(application: Application) {
  return (request: Request): Response | Promise<Response> => {
    const pathname = new URL(request.url).pathname;
    const asset = application.assets.get(pathname);
    if (!asset) return application.fetch(request);

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed.', {
        status: 405,
        headers: { Allow: 'GET, HEAD' },
      });
    }

    return new Response(request.method === 'HEAD' ? null : asset, {
      headers: {
        'Content-Type': asset.type,
        'Content-Length': String(asset.size),
        'Cache-Control': pathname.startsWith('/assets/')
          ? 'public, max-age=31536000, immutable'
          : 'no-cache',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  };
}

const help = `Calendarpit — a local calendar service for development and tests.

Usage: calendarpit [serve] [options]

Options:
  --host <host>    Bind address (default: 127.0.0.1)
  -p, --port <n>   Port (default: 4173; 0 selects an available port)
  --config <path> Seed a new database or memory session from a JSON fixture
  --database <path> SQLite file (default: .calendarpit/calendarpit.sqlite); :memory: for tests
  --rate-limit <mode> Calendar API quotas: off (default), prod, or strict
  -h, --help       Show this help
  -v, --version    Show the version

Environment:
  CALENDARPIT_HOST, CALENDARPIT_PORT, CALENDARPIT_CONFIG, CALENDARPIT_DATABASE
  CALENDARPIT_RATE_LIMIT: off, prod, or strict. Overrides the saved mode
  CLI flags take precedence
  CALENDARPIT_WATCH_HOSTS: additional allowed callback hosts, comma-separated

Local Google Calendar subset, OAuth, and watch notifications.
`;

export async function runCli(loadApplication: () => Promise<Application>) {
  try {
    const options = parseOptions(process.argv.slice(2), {
      CALENDARPIT_HOST: process.env.CALENDARPIT_HOST,
      CALENDARPIT_PORT: process.env.CALENDARPIT_PORT,
      CALENDARPIT_CONFIG: process.env.CALENDARPIT_CONFIG,
      CALENDARPIT_DATABASE: process.env.CALENDARPIT_DATABASE,
      CALENDARPIT_RATE_LIMIT: process.env.CALENDARPIT_RATE_LIMIT,
    });
    if (options.command === 'help') {
      console.info(help);
      return;
    }
    if (options.command === 'version') {
      console.info(VERSION);
      return;
    }

    if (options.config) process.env.CALENDARPIT_CONFIG = options.config;
    process.env.CALENDARPIT_DATABASE = options.database;
    if (options.rateLimitMode)
      process.env.CALENDARPIT_RATE_LIMIT = options.rateLimitMode;
    const application = await loadApplication();
    const server = Bun.serve({
      hostname: options.host,
      port: options.port,
      fetch: createHandler(application),
      error(error) {
        console.error(error);
        return new Response('Internal server error.', { status: 500 });
      },
    });

    console.info(`\nCalendarpit v${VERSION}`);
    console.info(`Data   ${options.database}`);
    console.info(`Admin  ${server.url}`);
    console.info(`API    ${new URL('/calendar/v3', server.url)}`);
    console.info(`Health ${new URL('/__calendarpit/health', server.url)}\n`);

    const shutdown = () => {
      void server.stop(true).then(() => {
        application.close?.();
        process.exit(0);
      });
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  } catch (error) {
    console.error(
      `Calendarpit: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}
