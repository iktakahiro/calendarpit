import type { SyncState, EventPage } from './sync';
import { resolveInstance } from './recurrence';
import { Persistence } from './persistence';
import {
  defaultFixture,
  fail,
  parseFixture,
  type Fixture,
  type Calendar,
  type CalendarEvent,
} from './model';

export type Grant = {
  id: string;
  userId: string;
  clientId: string;
  scopes: string[];
  revoked: boolean;
  created: string;
};
export type Token = { grantId: string; expires: number };
export type Code = {
  grantId: string;
  redirectUri: string;
  expires: number;
  challenge?: string;
  offline: boolean;
};
export type Consent = {
  clientId: string;
  redirectUri: string;
  scope: string[];
  state?: string;
  challenge?: string;
  offline: boolean;
  expires: number;
};
export type History = {
  id: string;
  time: string;
  method: string;
  path: string;
  status: number;
  request: unknown;
  response: unknown;
  headers: unknown;
  responseHeaders: unknown;
};
export type Channel = {
  id: string;
  grantId: string;
  calendarId: string;
  resourceId: string;
  resourceUri: string;
  address: string;
  token?: string;
  expiration: number;
  message: number;
  controller: AbortController;
  tail: Promise<void>;
};
export type Delivery = {
  id: string;
  channelId: string;
  state: string;
  messageNumber: number;
  time: string;
  attempts: number;
  status: 'queued' | 'delivered' | 'failed' | 'cancelled';
  httpStatus?: number;
};
export type StoreOptions = {
  fixture?: unknown;
  database?: string;
  now?: () => number;
  deliver?: (url: URL, init: RequestInit) => Promise<Response>;
  allowedWatchHosts?: string[];
  accessTokenTtlMs?: number;
  retryDelayMs?: number;
};
type SavedState = {
  version: 1;
  startup: Fixture;
  data: Fixture;
  grants: [string, Grant][];
  access: [string, Token][];
  refresh: [string, Token][];
  history: History[];
  channels: Omit<Channel, 'controller' | 'tail'>[];
  deliveries: Delivery[];
  syncTokens?: [string, SyncState][];
  deletedCalendars?: Calendar[];
  notifications?: Notification[];
};

export type Notification = {
  id: string;
  calendarId: string;
  eventId: string;
  method: 'REQUEST' | 'CANCEL' | 'REPLY';
  recipients: string[];
  sendUpdates: string;
  time: string;
};

export class Store {
  private persistence: Persistence;
  private closed = false;
  readonly storage: { mode: 'sqlite' | 'memory'; path?: string };
  data: Fixture;
  readonly startup: Fixture;
  readonly now: () => number;
  revision = crypto.randomUUID();
  grants = new Map<string, Grant>();
  access = new Map<string, Token>();
  refresh = new Map<string, Token>();
  codes = new Map<string, Code>();
  consents = new Map<string, Consent>();
  pages = new Map<string, { key: string; revision: string; offset: number }>();
  history: History[] = [];
  syncTokens = new Map<string, SyncState>();
  eventPages = new Map<string, EventPage>();
  deletedCalendars: Calendar[] = [];
  notifications: Notification[] = [];
  channels = new Map<string, Channel>();
  deliveries: Delivery[] = [];
  pending = new Set<Promise<void>>();
  constructor(readonly options: StoreOptions = {}) {
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
        parseFixture(saved.startup, this.now());
        parseFixture(saved.data, this.now());
        this.startup = saved.startup;
        this.data = saved.data;
        this.grants = new Map(saved.grants);
        this.access = new Map(saved.access);
        this.refresh = new Map(saved.refresh);
        this.history = saved.history.slice(-200);
        this.syncTokens = new Map(saved.syncTokens ?? []);
        this.deletedCalendars = saved.deletedCalendars ?? [];
        this.notifications = saved.notifications ?? [];
        this.deliveries = saved.deliveries.slice(-200).map((entry) => ({
          ...entry,
          status: entry.status === 'queued' ? 'cancelled' : entry.status,
        }));
        for (const channel of saved.channels) {
          if (
            channel.expiration <= this.now() ||
            !this.grants.has(channel.grantId) ||
            this.grants.get(channel.grantId)!.revoked
          )
            continue;
          // Recheck the current callback allowlist before restoring a subscription.
          try {
            this.callback(channel.address);
          } catch {
            continue;
          }
          this.channels.set(channel.id, {
            ...channel,
            controller: new AbortController(),
            tail: Promise.resolve(),
          });
        }
      } else {
        this.startup = parseFixture(
          options.fixture ?? defaultFixture,
          this.now(),
        );
        this.data = structuredClone(this.startup);
      }
      this.persist();
    } catch (error) {
      this.persistence.close();
      throw error;
    }
  }
  assertOpen() {
    if (this.closed) fail('Workspace is closed.', 503, 'unavailable');
  }
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
      notifications: this.notifications,
    };
    this.persistence.write(state);
  }
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
    }
  }
  touch() {
    this.revision = crypto.randomUUID();
    this.pages.clear();
  }
  stop(channel: Channel) {
    channel.controller.abort();
    this.channels.delete(channel.id);
  }
  clearRuntime() {
    for (const channel of this.channels.values()) this.stop(channel);
    this.grants.clear();
    this.access.clear();
    this.refresh.clear();
    this.codes.clear();
    this.consents.clear();
    this.history = [];
    this.syncTokens.clear();
    this.eventPages.clear();
    this.deletedCalendars = [];
    this.notifications = [];
    this.deliveries = [];
    this.touch();
  }
  reset() {
    this.clearRuntime();
    this.data = structuredClone(this.startup);
    this.persist();
  }
  load(value: unknown) {
    const data = parseFixture(value, this.now());
    this.clearRuntime();
    this.data = data;
    this.persist();
  }
  revoke(grantId: string) {
    const grant = this.grants.get(grantId);
    if (!grant) fail('Connection not found.', 404, 'notFound');
    grant.revoked = true;
    for (const channel of this.channels.values())
      if (channel.grantId === grantId) this.stop(channel);
    for (const map of [this.access, this.refresh, this.codes])
      for (const [key, token] of map)
        if (token.grantId === grantId) map.delete(key);
  }
  calendar(calendarId: string, userId?: string): Calendar {
    const c = this.data.calendars.find((c) =>
      calendarId === 'primary'
        ? c.primary && c.userId === userId
        : c.id === calendarId,
    );
    if (!c || (userId && c.userId !== userId))
      fail('Calendar not found.', 404, 'notFound');
    return c;
  }
  event(calendarId: string, eventId: string): CalendarEvent {
    const e =
      this.data.events.find(
        (e) => e.calendarId === calendarId && e.id === eventId,
      ) ??
      resolveInstance(this.data.events, this.calendar(calendarId), eventId);
    if (!e) fail('Event not found.', 404, 'notFound');
    return e;
  }
  snapshot() {
    this.expireChannels();
    return {
      storage: this.storage,
      users: this.data.users,
      calendars: this.data.calendars,
      events: this.data.events,
      clients: this.data.clients.map(({ id, redirectUris }) => ({
        id,
        redirectUris,
      })),
      connections: [...this.grants.values()],
      channels: [...this.channels.values()].map(
        ({ controller: _controller, tail: _tail, token, ...c }) => ({
          ...c,
          ...(token ? { token: '[REDACTED]' } : {}),
        }),
      ),
      deliveries: this.deliveries,
      notifications: this.notifications,
      revision: this.revision,
    };
  }
  expireChannels() {
    for (const c of this.channels.values())
      if (c.expiration <= this.now() || this.grants.get(c.grantId)?.revoked)
        this.stop(c);
  }
  callback(address: string): URL {
    let url: URL;
    try {
      url = new URL(address);
    } catch {
      return fail('Invalid watch callback URL.');
    }
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.hash
    )
      fail('Invalid watch callback URL.');
    if (
      ![
        '127.0.0.1',
        '[::1]',
        'localhost',
        ...(this.options.allowedWatchHosts ?? []),
      ].includes(url.hostname)
    )
      fail(
        'Watch host is not allowed. Configure CALENDARPIT_WATCH_HOSTS explicitly.',
      );
    if (url.hostname === 'localhost') url.hostname = '127.0.0.1';
    return url;
  }
  notify(calendarId: string) {
    this.expireChannels();
    for (const c of this.channels.values())
      if (c.calendarId === calendarId) this.enqueue(c, 'exists');
  }
  enqueue(channel: Channel, state: 'sync' | 'exists') {
    const entry: Delivery = {
      id: crypto.randomUUID(),
      channelId: channel.id,
      state,
      messageNumber: ++channel.message,
      time: new Date(this.now()).toISOString(),
      attempts: 0,
      status: 'queued',
    };
    this.deliveries.push(entry);
    this.deliveries = this.deliveries.slice(-200);
    this.persist();
    const active = () =>
      !this.closed &&
      !channel.controller.signal.aborted &&
      channel.expiration > this.now() &&
      this.channels.get(channel.id) === channel &&
      !this.grants.get(channel.grantId)?.revoked;
    const task = channel.tail
      .then(async () => {
        for (let attempt = 0; attempt < 3; attempt++) {
          if (!active()) {
            entry.status = 'cancelled';
            return;
          }
          entry.attempts++;
          try {
            const headers: Record<string, string> = {
              'X-Goog-Channel-ID': channel.id,
              'X-Goog-Resource-ID': channel.resourceId,
              'X-Goog-Resource-URI': channel.resourceUri,
              'X-Goog-Resource-State': state,
              'X-Goog-Message-Number': String(entry.messageNumber),
              'X-Goog-Channel-Expiration': new Date(
                channel.expiration,
              ).toUTCString(),
            };
            if (channel.token) headers['X-Goog-Channel-Token'] = channel.token;
            const response = await (this.options.deliver ?? fetch)(
              this.callback(channel.address),
              {
                method: 'POST',
                headers,
                body: '',
                redirect: 'manual',
                signal: AbortSignal.any([
                  channel.controller.signal,
                  AbortSignal.timeout(2000),
                ]),
              },
            );
            entry.httpStatus = response.status;
            await response.body?.cancel();
            if (!active()) {
              entry.status = 'cancelled';
              return;
            }
            if ([200, 201, 202, 204].includes(response.status)) {
              entry.status = 'delivered';
              return;
            }
          } catch {
            /* Failures are recorded without including callback credentials. */
          }
          if (attempt < 2 && active())
            await new Promise<void>((resolve) => {
              const done = () => {
                clearTimeout(timer);
                channel.controller.signal.removeEventListener('abort', done);
                resolve();
              };
              const timer = setTimeout(done, this.options.retryDelayMs ?? 100);
              channel.controller.signal.addEventListener('abort', done, {
                once: true,
              });
            });
        }
        entry.status = active() ? 'failed' : 'cancelled';
      })
      .catch(() => {
        entry.status = 'failed';
      });
    channel.tail = task;
    this.pending.add(task);
    void task.finally(() => {
      this.pending.delete(task);
      try {
        this.persist();
      } catch (error) {
        console.error('Failed to persist watch delivery:', error);
      }
    });
  }
  async drain() {
    await Promise.all([...this.pending]);
  }
}
