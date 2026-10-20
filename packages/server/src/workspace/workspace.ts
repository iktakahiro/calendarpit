import { fail } from '../shared/errors';
import type { CalendarListSettings } from '../model/calendar-list';
import type { Calendar } from '../model/directory';
import type { Fixture } from '../model/fixture';
import type { History } from '../model/history';
import type { Notification } from '../model/notification';
import type { Code, Consent, Grant, Token } from '../model/oauth';
import type { EventPage, PageCursor, SyncState } from '../model/sync';
import type { Channel, Delivery, SavedChannel } from '../model/watch';
import { Persistence } from './persistence';

/** Options for {@link createCalendarpit}. Every option has a local default. */
export type WorkspaceOptions = {
  /**
   * Seed data for a new database, in {@link Fixture} shape. Ignored when the
   * database already holds a saved workspace. `createCalendarpit` substitutes
   * the built-in fixture when it is omitted.
   */
  fixture?: unknown;
  /** SQLite file path or `:memory:`. Defaults to `:memory:`. */
  database?: string;
  /** Clock in epoch milliseconds. Inject one to test expiry without sleeping. */
  now?: () => number;
  /** Sends a watch notification. Defaults to `fetch`; inject to observe calls. */
  deliver?: (url: URL, init: RequestInit) => Promise<Response>;
  /** Extra watch callback hosts besides loopback. Must be set explicitly. */
  allowedWatchHosts?: string[];
  /** Access token lifetime. Defaults to one hour. */
  accessTokenTtlMs?: number;
  /** Delay between watch delivery retries. Defaults to 100 ms. */
  retryDelayMs?: number;
};

/**
 * Rules that decide whether saved data may be reopened. They are injected
 * because they belong to features, and the workspace layer cannot import
 * features.
 */
export type WorkspaceRestoreRules = {
  /** Validates fixture data and returns it in canonical form. */
  parseFixture(value: unknown, now: number): Fixture;
  /** Whether a saved watch channel may resume after a restart. */
  canResumeChannel(channel: SavedChannel, workspace: Workspace): boolean;
};

/** Version 1 of the snapshot stored in the SQLite `workspace` row. */
type SavedState = {
  version: 1;
  startup: Fixture;
  data: Fixture;
  grants: [string, Grant][];
  access: [string, Token][];
  refresh: [string, Token][];
  history: History[];
  channels: SavedChannel[];
  deliveries: Delivery[];
  syncTokens?: [string, SyncState][];
  deletedCalendars?: Calendar[];
  calendarListEntries?: CalendarListSettings[];
  notifications?: Notification[];
};

/**
 * What a {@link Workspace.subscribe} listener hears: `change` after a saved
 * snapshot differs from the previous one, and `close` once when the workspace
 * closes. Listeners are dropped after `close`.
 */
export type WorkspaceSignal = 'change' | 'close';

/** Upper bound for retained history, delivery, and notification records. */
export const recordLimit = 200;

/**
 * All state of one Calendarpit instance: calendar data, OAuth state, watch
 * channels, and logs. Features read and change the public fields through their
 * operation modules. The workspace itself only handles persistence and
 * lifecycle.
 *
 * Opening a database restores the saved snapshot: data, its reset baseline,
 * grants, tokens, unexpired channels, sync tokens, and bounded logs. Consents,
 * authorization codes, and page cursors are deliberately not persisted.
 */
export class Workspace {
  private persistence: Persistence;
  private closed = false;
  private listeners = new Set<(signal: WorkspaceSignal) => void>();
  /** Where the snapshot lives, for display in the admin UI. */
  readonly storage: { mode: 'sqlite' | 'memory'; path?: string };
  /** Current calendar data. */
  data: Fixture;
  /** The fixture the workspace was created with. Reset restores it. */
  readonly startup: Fixture;
  /** The injected clock. */
  readonly now: () => number;
  /** Changes on every data write; invalidates non-event page cursors. */
  revision = crypto.randomUUID();
  grants = new Map<string, Grant>();
  /** Access tokens by token value. */
  access = new Map<string, Token>();
  /** Refresh tokens by token value. */
  refresh = new Map<string, Token>();
  /** Authorization codes by code value. Not persisted. */
  codes = new Map<string, Code>();
  /** Pending consent requests by nonce. Not persisted. */
  consents = new Map<string, Consent>();
  /** Cursors for non-event lists. Not persisted. */
  pages = new Map<string, PageCursor>();
  history: History[] = [];
  syncTokens = new Map<string, SyncState>();
  /** Frozen event list pages. Not persisted. */
  eventPages = new Map<string, EventPage>();
  /** Tombstones returned by `calendarList` with `showDeleted=true`. */
  deletedCalendars: Calendar[] = [];
  /**
   * Per-user calendar-list customizations and removals. Missing records use
   * the default entry for an owned calendar.
   */
  calendarListEntries: CalendarListSettings[] = [];
  notifications: Notification[] = [];
  channels = new Map<string, Channel>();
  deliveries: Delivery[] = [];
  /** In-flight delivery tasks, awaited by `drain`. */
  pending = new Set<Promise<void>>();

  /**
   * Opens the database and restores its snapshot, or seeds it from the
   * fixture when it is empty.
   *
   * @throws Error when the database is locked by another instance, has an
   * unsupported version, or holds data that fails validation. The database is
   * closed again before the error propagates.
   */
  constructor(
    readonly options: WorkspaceOptions,
    rules: WorkspaceRestoreRules,
  ) {
    this.now = options.now ?? Date.now;
    this.persistence = new Persistence(options.database);
    this.storage =
      this.persistence.path === ':memory:'
        ? { mode: 'memory' }
        : { mode: 'sqlite', path: this.persistence.path };
    try {
      const saved = this.persistence.read() as SavedState | undefined;
      if (saved !== undefined) {
        if (saved.version !== 1)
          throw new Error('Unsupported saved state version.');
        // Validate relationships without regenerating saved event metadata or IDs.
        rules.parseFixture(saved.startup, this.now());
        rules.parseFixture(saved.data, this.now());
        this.startup = saved.startup;
        this.data = saved.data;
        this.grants = new Map(saved.grants);
        this.access = new Map(saved.access);
        this.refresh = new Map(saved.refresh);
        this.history = saved.history.slice(-recordLimit);
        this.syncTokens = new Map(saved.syncTokens ?? []);
        this.deletedCalendars = saved.deletedCalendars ?? [];
        this.calendarListEntries = saved.calendarListEntries ?? [];
        this.notifications = saved.notifications ?? [];
        // Deliveries never replay after a restart.
        this.deliveries = saved.deliveries.slice(-recordLimit).map((entry) => ({
          ...entry,
          status: entry.status === 'queued' ? 'cancelled' : entry.status,
        }));
        for (const channel of saved.channels)
          if (rules.canResumeChannel(channel, this))
            this.channels.set(channel.id, {
              ...channel,
              controller: new AbortController(),
              tail: Promise.resolve(),
            });
      } else {
        this.startup = rules.parseFixture(options.fixture, this.now());
        this.data = structuredClone(this.startup);
      }
      this.persist();
    } catch (error) {
      this.persistence.close();
      throw error;
    }
  }

  /** Whether {@link close} has run. */
  get isClosed() {
    return this.closed;
  }

  /** @throws {@link ApiError} 503 `unavailable` once the workspace is closed. */
  assertOpen() {
    if (this.closed) fail('Workspace is closed.', 503, 'unavailable');
  }

  /**
   * Writes the snapshot when it differs from the last write and then signals
   * `change` to subscribers. Does nothing after {@link close}.
   */
  persist() {
    if (this.closed) return;
    const state: SavedState = {
      version: 1,
      startup: this.startup,
      data: this.data,
      grants: [...this.grants],
      access: [...this.access],
      refresh: [...this.refresh],
      history: this.history,
      channels: [...this.channels.values()].map(
        ({ controller: _controller, tail: _tail, ...channel }) => channel,
      ),
      deliveries: this.deliveries,
      syncTokens: [...this.syncTokens],
      deletedCalendars: this.deletedCalendars,
      calendarListEntries: this.calendarListEntries,
      notifications: this.notifications,
    };
    if (this.persistence.write(state)) this.signal('change');
  }

  /**
   * Registers a listener for saved changes and for closing. Every request and
   * background delivery persists through {@link persist}, so a `change` covers
   * Calendar API, OAuth, watch, and management writes alike.
   *
   * @returns A function that removes the listener.
   */
  subscribe(listener: (signal: WorkspaceSignal) => void): () => void {
    if (this.closed) {
      listener('close');
      return () => {};
    }
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private signal(signal: WorkspaceSignal) {
    for (const listener of [...this.listeners]) listener(signal);
  }

  /**
   * Aborts channels, cancels queued deliveries, saves, and releases the
   * database lock. Safe to call more than once.
   */
  close() {
    if (this.closed) return;
    for (const channel of this.channels.values()) channel.controller.abort();
    for (const entry of this.deliveries)
      if (entry.status === 'queued') entry.status = 'cancelled';
    try {
      this.persist();
    } finally {
      this.closed = true;
      this.persistence.close();
      this.signal('close');
      this.listeners.clear();
    }
  }

  /** Marks a data change: issues a new revision and drops page cursors. */
  touch() {
    this.revision = crypto.randomUUID();
    this.pages.clear();
  }
}
