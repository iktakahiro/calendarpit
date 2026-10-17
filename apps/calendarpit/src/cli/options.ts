import { parseArgs } from 'node:util';
import { resolveDatabase } from '@calendarpit/server';

export type CliOptions =
  | { command: 'help' }
  | { command: 'version' }
  | {
      command: 'serve';
      host: string;
      port: number;
      config?: string;
      database: string;
    };

export function parseOptions(
  args: string[],
  env: {
    CALENDARPIT_HOST?: string;
    CALENDARPIT_PORT?: string;
    CALENDARPIT_CONFIG?: string;
    CALENDARPIT_DATABASE?: string;
  } = {},
): CliOptions {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    strict: true,
    options: {
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'v' },
      host: { type: 'string' },
      config: { type: 'string' },
      database: { type: 'string' },
      port: { type: 'string', short: 'p' },
    },
  });

  if (values.help) return { command: 'help' };
  if (values.version) return { command: 'version' };
  if (
    positionals.length > 1 ||
    (positionals[0] && positionals[0] !== 'serve')
  ) {
    throw new Error(
      'Unknown command. Use "calendarpit serve" or "calendarpit --help".',
    );
  }

  const host = values.host ?? env.CALENDARPIT_HOST ?? '127.0.0.1';
  const rawPort = values.port ?? env.CALENDARPIT_PORT ?? '4173';
  if (!host.trim()) throw new Error('Host must not be empty.');
  if (!/^\d+$/.test(rawPort) || Number(rawPort) > 65535) {
    throw new Error('Port must be an integer between 0 and 65535.');
  }
  const config = values.config ?? env.CALENDARPIT_CONFIG;
  if (config !== undefined && !config.trim())
    throw new Error('Config path must not be empty.');
  return {
    command: 'serve',
    host,
    port: Number(rawPort),
    database: resolveDatabase(values.database ?? env.CALENDARPIT_DATABASE),
    ...(config ? { config } : {}),
  };
}
