# Server package

`@calendarpit/server` implements Google-compatible Calendar and OAuth behavior,
the management API, persistence, and watch delivery. It has no React, CLI, or
admin UI dependency. The root [AGENTS.md](../../AGENTS.md) still applies.

## Layout

| Path                   | Responsibility                                                               |
| ---------------------- | ---------------------------------------------------------------------------- |
| `src/index.ts`         | Public package API. The only module that re-exports.                         |
| `src/app.ts`           | `createCalendarpit()`: wires the workspace, routes, and protocol history.    |
| `src/shared/`          | Domain-neutral helpers: API errors, input validation, and secrets.           |
| `src/model/`           | Type-only record shapes. They define the saved snapshot schema.              |
| `src/workspace/`       | The `Workspace` state container, SQLite persistence, and serialization.      |
| `src/http/`            | Request parsing, response formatting, routing, and paging for route modules. |
| `src/features/<name>/` | One directory per capability, such as `events`, `oauth`, or `watch`.         |
| `src/testing/`         | Test helpers. Production code never imports them.                            |

## File roles inside a feature

The file name states the role. Anything without a role suffix is a rule module.

- `*-routes.ts`: HTTP adapters. Match a path, authenticate, parse the request,
  call operations, and shape the Google or management JSON response. Only route
  modules import `src/http/`.
- `*-operations.ts`: read and change `Workspace` state. They know nothing about
  `Request` or `Response`.
- Rule modules: deterministic validation, invariants, and calculations on plain
  values. They never import `src/workspace/` or `src/http/`, so they can be
  unit-tested without a workspace.

## Dependency rules

- `shared/` imports nothing else from `src/`. `model/` imports only `model/`.
- `workspace/` imports only `shared/` and `model/`.
- `http/` imports only `shared/`, `model/`, and `workspace/`.
- A feature may import another feature's rule or operation modules, never its
  route modules. Keep imports one-way; Oxlint rejects import cycles.
- Nothing inside `src/` imports `app.ts` or `index.ts`, and production code never
  imports `testing/`.

[`src/architecture.test.ts`](src/architecture.test.ts) enforces these rules.

## Behavior rules

- Reject unsupported fields, query parameters, and features explicitly with the
  `unsupportedFeature` reason. Never silently degrade a recurring event.
- Treat each HTTP request as one unit of work. `app.ts` persists once after
  dispatch. An operation that fails must leave state unchanged.
- Read time from `workspace.now()`, never `Date.now()`, so clocks stay injectable.
- Use Temporal with explicit time zones for local-time arithmetic.
- Keep Google wire shapes in `model/`. Add a mapping layer only when the stored
  shape and the wire shape actually diverge.

## Tests

- Rule modules: co-located unit tests, table-driven with `test.each` where
  several cases share one contract.
- Operations: an in-memory workspace from `src/testing/` with a fixed clock.
- Routes: HTTP contract tests through `app.handle()`, grouped by feature.
- Restart, token, and watch lifecycles: tests against a temporary SQLite file.
