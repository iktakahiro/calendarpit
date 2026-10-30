import { afterEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { mkdirSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { Persistence, resolveDatabase } from './persistence';

const directories: string[] = [];
const instances = new Set<Persistence>();

function file() {
  const directory = mkdtempSync(join(tmpdir(), 'calendarpit-persistence-'));
  directories.push(directory);
  return join(directory, 'nested', 'workspace.sqlite');
}

function open(path: string) {
  const instance = new Persistence(path);
  instances.add(instance);
  return instance;
}

function close(instance: Persistence) {
  instance.close();
  instances.delete(instance);
}

afterEach(() => {
  for (const instance of instances) instance.close();
  instances.clear();
  for (const directory of directories)
    rmSync(directory, { recursive: true, force: true });
  directories.length = 0;
});

describe('resolveDatabase', () => {
  test('resolves default and relative paths and preserves memory databases', () => {
    expect(resolveDatabase()).toBe(resolve('.calendarpit/calendarpit.sqlite'));
    expect(resolveDatabase('nested/workspace.sqlite')).toBe(
      resolve('nested/workspace.sqlite'),
    );
    expect(resolveDatabase(':memory:')).toBe(':memory:');
  });

  test.each(['', ' ', '\t\n'])('rejects an empty path %j', (path) => {
    expect(() => resolveDatabase(path)).toThrow(
      'Database path must not be empty',
    );
  });
});

describe('Persistence', () => {
  test('round-trips snapshots and skips unchanged writes after writing and reading', () => {
    const path = file();
    const first = open(path);
    const initial = { users: ['alex'], nested: { count: 1 } };
    const changed = { users: ['alex'], nested: { count: 2 } };

    expect(first.read()).toBeUndefined();
    expect(first.write(initial)).toBe(true);
    const guard = new Database(path);
    try {
      guard.exec(`CREATE TRIGGER reject_unchanged_update
        BEFORE UPDATE ON workspace WHEN OLD.state = NEW.state
        BEGIN SELECT RAISE(ABORT, 'unchanged update'); END`);
    } finally {
      guard.close();
    }
    expect(first.write(structuredClone(initial))).toBe(false);
    close(first);

    const second = open(path);
    expect(second.read()).toEqual(initial);
    expect(second.write(structuredClone(initial))).toBe(false);
    expect(second.write(changed)).toBe(true);
    close(second);
    expect(open(path).read()).toEqual(changed);
  });

  test('creates the parent directory and private database and lock files', () => {
    const path = file();
    open(path);
    expect(statSync(path).isFile()).toBe(true);
    expect(statSync(`${path}.lock`).isFile()).toBe(true);
    if (process.platform !== 'win32') {
      expect(statSync(path).mode & 0o777).toBe(0o600);
      expect(statSync(`${path}.lock`).mode & 0o777).toBe(0o600);
    }
  });

  test('accepts a version 0 database and initializes WAL and schema version 1', () => {
    const path = file();
    mkdirSync(dirname(path), { recursive: true });
    const legacy = new Database(path, { create: true });
    expect(legacy.query('PRAGMA user_version').get()).toEqual({
      user_version: 0,
    });
    legacy.close();

    open(path);
    const inspect = new Database(path);
    try {
      expect(inspect.query('PRAGMA journal_mode').get()).toEqual({
        journal_mode: 'wal',
      });
      expect(inspect.query('PRAGMA user_version').get()).toEqual({
        user_version: 1,
      });
    } finally {
      inspect.close();
    }
  });
});
