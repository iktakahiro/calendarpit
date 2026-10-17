# Calendarpit app

This workspace contains the React admin UI (TanStack Start), the Bun CLI, and the
packaging scripts. Google-compatible behavior belongs in `@calendarpit/server`;
the UI talks to it only through the management API. The root
[AGENTS.md](../../AGENTS.md) still applies.

## Layout

| Path                   | Responsibility                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------- |
| `src/routes/`          | File routes. Parse params and search, then render one feature screen.                 |
| `src/features/<name>/` | `<name>-screen.tsx`, plus `components/`, `hooks/`, and `models/` as needed.           |
| `src/components/`      | Shared, domain-neutral UI such as icons.                                              |
| `src/lib/`             | Shared, domain-neutral utilities: the management API client, query client, and theme. |
| `src/cli/`             | The production CLI runtime. It never imports UI modules.                              |

Inside a feature:

- `components/`: declarative views that render from props and hooks.
- `hooks/`: `use-*.ts` data and mutation hooks built on TanStack Query, plus
  handlers that need React state.
- `models/`: pure functions and view-model types. No React, no fetch. Most UI
  unit tests live here.

Do not use Atomic Design categories. Add a folder only when the feature has code
for it. Do not split a container from a view by default: call data hooks at the
top of the component and render the JSX from plain values.

## Dependency rules

- Routes import features, `components/`, and `lib/`. Features never import routes.
- A feature may import another feature one way. Do not create cycles.
- `components/` and `lib/` never import features or routes.
- `models/` never imports React, hooks, components, or the API client.
- `cli/` never imports routes, features, or components.

[`src/architecture.test.ts`](src/architecture.test.ts) enforces these rules.

## React and data

- Keep URL-representable state (section, user, calendar, date) in route search
  params, not `useState`.
- Use TanStack Query for management API reads and mutations. Mutations invalidate
  the queries they affect instead of refetching by hand.
- Derive values during render. Use effects only to sync with external systems,
  and memoize only for a measured need.
- Forms use TanStack Form with one form-level validator,
  `revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' })`, and read
  submitting state with `form.Subscribe`.

## UI quality

- Label icon-only buttons with `aria-label`; mark decorative icons `aria-hidden`.
- Make loading, empty, error, and disabled states usable. Show errors near the
  action that caused them.
- Use `tabular-nums` for timestamps and durations.
- Respect reduced motion. Do not add an animation or component library.

## Tests

- Unit-test `models/` and `lib/` with `bun:test`.
- Use `react-dom/server` rendering only when the markup itself is the contract.
- Playwright covers user flows end to end against an in-memory server.
