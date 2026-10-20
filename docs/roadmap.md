# Implementation roadmap

Implemented workflows and remaining integration and release work.

## Implemented

- Bun/Turborepo tooling, strict type checks, linting, formatting and CI.
- Local admin UI, CLI, embedded executable and health endpoint.
- Fixture validation, fixed IDs, SQLite persistence, isolated memory sessions and a durable reset baseline.
- Users/calendars, primary resolution, event CRUD and extended properties.
- Timed/all-day events, DST-aware intervals, snapshot pagination and free/busy.
- Incremental synchronization, durable sync tokens and cancellation tombstones.
- Bounded recurrence expansion, exceptions, local invitations/RSVP, metadata and synthetic conferences.
- Local approval/denial, code exchange, S256 PKCE, refresh and revocation.
- Event watch registration/stop, initial sync, bounded delivery retries,
  expiration and cancellation on reset/revocation.
- Admin day track and week grid, event editor, user/calendar settings, connection controls, history,
  channel/delivery inspection and fixture controls.
- Official Google SDK sample with local-only HTTP integration tests, including
  reset/repeat, denial, revocation/reconnection, busy intervals and watch delivery.

## Next integration checkpoint

Consumer maintainers validate their application using explicit provider endpoint
settings, including UI, database and sync-worker behavior. Keep app-specific behavior outside Calendarpit. Additional compatibility
must be documented and tested instead of silently accepted.

## Release work

Version 0.9.5 is published through GHCR, GitHub Releases, and the Homebrew tap.
The release workflow validates native executables and containers before publication.
Validate new release versions in a dry run and verify each public installation
channel after publication. See [Releasing](releasing.md).

## Out of scope

ACLs, shared-calendar access, real email/reminder delivery, real Meet generation,
full OIDC, other providers and production Google synchronization remain excluded.
The admin editor remains focused on basic event fields; advanced recurrence and
invitation scenarios use API requests or fixtures. Dragging to move or resize an event can follow the day and week views.
