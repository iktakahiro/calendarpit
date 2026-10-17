import { describe, expect, test } from 'bun:test';
import { parseOptions } from './options';
import { resolve } from 'node:path';

describe('CLI options', () => {
  test('binds only to loopback by default', () => {
    expect(parseOptions([])).toEqual({
      command: 'serve',
      host: '127.0.0.1',
      port: 4173,
      database: resolve('.calendarpit/calendarpit.sqlite'),
    });
  });

  test('supports environment configuration with flag precedence', () => {
    expect(
      parseOptions(['serve', '--port', '0'], {
        CALENDARPIT_HOST: '::1',
        CALENDARPIT_PORT: '5000',
      }),
    ).toEqual({
      command: 'serve',
      host: '::1',
      port: 0,
      database: resolve('.calendarpit/calendarpit.sqlite'),
    });
    expect(
      parseOptions(['--host', '0.0.0.0'], {
        CALENDARPIT_HOST: '127.0.0.1',
        CALENDARPIT_PORT: '5000',
      }),
    ).toEqual({
      command: 'serve',
      host: '0.0.0.0',
      port: 5000,
      database: resolve('.calendarpit/calendarpit.sqlite'),
    });
  });

  test.each(['-1', '65536', 'abc', '42abc', '1.5', ''])(
    'rejects invalid port %s',
    (port) => {
      expect(() => parseOptions(['--port', port])).toThrow();
    },
  );

  test('rejects empty hosts, unsupported commands, and misspelled flags', () => {
    expect(() => parseOptions(['--host', ''])).toThrow();
    expect(() => parseOptions(['reset'])).toThrow();
    expect(() => parseOptions(['serve', 'extra'])).toThrow();
    expect(() => parseOptions(['--prot', '3000'])).toThrow();
  });

  test('help and version do not need server configuration', () => {
    expect(parseOptions(['--help'], { CALENDARPIT_PORT: 'invalid' })).toEqual({
      command: 'help',
    });
    expect(parseOptions(['--version'])).toEqual({ command: 'version' });
  });
});

test('config files support CLI precedence and reject empty paths', () => {
  expect(
    parseOptions(['--config', '/tmp/explicit.json'], {
      CALENDARPIT_CONFIG: '/tmp/environment.json',
    }),
  ).toEqual({
    command: 'serve',
    host: '127.0.0.1',
    port: 4173,
    database: resolve('.calendarpit/calendarpit.sqlite'),
    config: '/tmp/explicit.json',
  });
  expect(() => parseOptions(['--config', ''])).toThrow(
    'Config path must not be empty.',
  );
});

test('database defaults, memory mode and flag precedence', () => {
  expect(
    parseOptions(['--database', ':memory:'], {
      CALENDARPIT_DATABASE: '/tmp/saved.sqlite',
    }),
  ).toMatchObject({ database: ':memory:' });
  expect(
    parseOptions([], { CALENDARPIT_DATABASE: '/tmp/saved.sqlite' }),
  ).toMatchObject({ database: '/tmp/saved.sqlite' });
  expect(parseOptions(['--database', './other.sqlite'])).toMatchObject({
    database: resolve('other.sqlite'),
  });
  expect(() => parseOptions(['--database', ''])).toThrow(
    'Database path must not be empty.',
  );
  expect(() => parseOptions([], { CALENDARPIT_DATABASE: ' ' })).toThrow();
});
