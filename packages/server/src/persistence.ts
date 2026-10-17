import { Database } from 'bun:sqlite';
import { chmodSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export function resolveDatabase(value = '.calendarpit/calendarpit.sqlite') {
  if (!value.trim()) throw new Error('Database path must not be empty.');
  return value === ':memory:' ? value : resolve(value);
}

/** A versioned, atomic snapshot keeps protocol state and its reset baseline together. */
export class Persistence {
  readonly path: string;
  private db!: Database;
  private lock?: Database;
  private previous?: string;

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

  read(): unknown {
    const row = this.db
      .query<{ state: string }, []>('SELECT state FROM workspace WHERE id = 1')
      .get();
    this.previous = row?.state;
    return row ? JSON.parse(row.state) : undefined;
  }

  write(state: unknown) {
    const value = JSON.stringify(state);
    if (value === this.previous) return;
    this.db
      .query(
        'INSERT INTO workspace (id, state) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET state = excluded.state',
      )
      .run(value);
    this.previous = value;
  }

  close() {
    this.db.close();
    this.lock?.close();
  }
}
