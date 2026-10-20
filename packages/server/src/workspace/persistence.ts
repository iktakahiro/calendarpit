import { Database } from 'bun:sqlite';
import { chmodSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/**
 * Normalizes a database option to an absolute path, keeping `:memory:` as is.
 *
 * @param value - Path relative to the current directory, or `:memory:`.
 * Defaults to `.calendarpit/calendarpit.sqlite`.
 * @throws Error when the path is empty.
 */
export function resolveDatabase(value = '.calendarpit/calendarpit.sqlite') {
  if (!value.trim()) throw new Error('Database path must not be empty.');
  return value === ':memory:' ? value : resolve(value);
}

/**
 * Stores the workspace snapshot as one JSON row in SQLite.
 *
 * A versioned, atomic snapshot keeps protocol state and its reset baseline
 * together. File databases use WAL with FULL synchronization and mode 0600. A
 * separate lock file holds an exclusive SQLite lock for the instance's
 * lifetime, so two processes cannot overwrite one workspace. The OS releases
 * the lock on exit, including crashes.
 */
export class Persistence {
  readonly path: string;
  private db!: Database;
  private lock?: Database;
  private previous?: string;

  /**
   * @param path - SQLite file path or `:memory:`.
   * @throws Error when another instance holds the lock or the schema version
   * is unsupported.
   */
  constructor(path = ':memory:') {
    this.path = resolveDatabase(path);
    if (this.path !== ':memory:') {
      mkdirSync(dirname(this.path), { recursive: true, mode: 0o700 });
      const lock = new Database(`${this.path}.lock`, { create: true });
      try {
        lock.exec('BEGIN EXCLUSIVE');
        chmodSync(`${this.path}.lock`, 0o600);
      } catch (error) {
        lock.close();
        throw new Error(
          `Database is already in use: ${this.path}. Use a separate path or :memory:.`,
          { cause: error },
        );
      }
      this.lock = lock;
    }
    try {
      this.db = new Database(this.path, { create: true, strict: true });
      const version = this.db
        .query<{ user_version: number }, []>('PRAGMA user_version')
        .get()!.user_version;
      if (version !== 0 && version !== 1)
        throw new Error(`Unsupported database version: ${version}`);
      if (this.path !== ':memory:') chmodSync(this.path, 0o600);
      this.db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;');
      this.db.transaction(() => {
        this.db.exec(
          'CREATE TABLE IF NOT EXISTS workspace (id INTEGER PRIMARY KEY CHECK (id = 1), state TEXT NOT NULL); PRAGMA user_version = 1;',
        );
      })();
    } catch (error) {
      this.db?.close();
      this.lock?.close();
      throw error;
    }
  }

  /** Returns the saved snapshot, or `undefined` for a new database. */
  read(): unknown {
    const row = this.db
      .query<{ state: string }, []>('SELECT state FROM workspace WHERE id = 1')
      .get();
    this.previous = row?.state;
    return row ? JSON.parse(row.state) : undefined;
  }

  /**
   * Saves the snapshot, skipping the write when nothing changed.
   *
   * @returns Whether the snapshot differed from the last one read or written.
   */
  write(state: unknown): boolean {
    const value = JSON.stringify(state);
    if (value === this.previous) return false;
    this.db
      .query(
        'INSERT INTO workspace (id, state) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET state = excluded.state',
      )
      .run(value);
    this.previous = value;
    return true;
  }

  /** Closes the database and releases the instance lock. */
  close() {
    this.db.close();
    this.lock?.close();
  }
}
