# Calendarpit development

- Write source code, comments, documentation, issues, and commit messages in English.
- Use Bun for runtime code, package management, tests, and type checking (`bun check`).
- Use Turborepo to orchestrate workspace tasks, Oxlint for linting, and Oxfmt for formatting.
- Use React, TanStack Start/Router/Form, Kumo, Tailwind CSS, and Gravity UI Icons for the admin UI.
- Keep dependencies on exact versions and commit the Bun lockfile when commits are requested.
- Preserve the 48-hour dependency release-age gate in `bunfig.toml` and the matching two-day cooldown in `.ncurc.json`. Do not bypass the gate or add exclusions without explicit user authorization.
- Keep Google-compatible HTTP behavior separate from the admin UI and the CLI.
- Use Bun’s built-in SQLite for local persistence by default; support `--database :memory:` for isolated E2E sessions. Do not introduce an external database server. Preserve the saved reset baseline and test restart, token, and watch lifecycles.
- Do not add Chronock-specific behavior or fixtures. Chronock is an integration consumer.
- Treat `apps/docs/src/content/docs/mvp.mdx` as the product scope; distinguish implemented behavior from planned behavior.
- Explicitly reject unsupported API features. Never silently degrade a recurring event into a single event.
- Keep runtime assets local except for the admin UI's Roboto Mono font, which loads from Google Fonts with system-font fallbacks. Calendar and OAuth behavior must not require real Google credentials or network access to Google.
- Bind to loopback by default. A non-loopback host must be explicitly configured.
- Use the 1Password MCP server for any work with 1Password developer environments.
- Use the built-in in-app browser (`iab`) for browser interaction unless another browser is explicitly requested.
- Stay on `main` during initial setup. Do not create commits unless the user asks.
- For authorized commits, follow [.agents/skills/commit/SKILL.md](.agents/skills/commit/SKILL.md) and use English Conventional Commits. Push only when explicitly requested.

## Code organization

Read the nearest scoped guide before editing a workspace:
[packages/server/AGENTS.md](packages/server/AGENTS.md) and
[apps/calendarpit/AGENTS.md](apps/calendarpit/AGENTS.md). The rationale lives in
[apps/docs/src/content/docs/architecture.mdx](apps/docs/src/content/docs/architecture.mdx).

- Organize code by feature, not by technical category. Keep code in its owning
  feature and promote it to a shared location only when it is domain-neutral.
- Use kebab-case file and directory names, except framework-required route names.
- Do not use `any`. Narrow `unknown` at the boundary where data enters.
- Prefer static imports. A dynamic import needs a comment that states why.
- Do not add barrel files. A package entry point is the only re-exporting module.
- Write English TSDoc for every exported function, class, type, and constant.
  Describe the contract: purpose, non-obvious parameters and results, thrown
  errors, and the Google behavior it mirrors or rejects. Calendarpit is an OSS
  library, so the documentation is part of the public interface.
- Use other comments only for intent or constraints the code cannot show.
- `architecture.test.ts` files enforce dependency rules. Change a rule, its
  documentation, and its test together; never bypass a failing rule.

## Validation

Run `bun run validate` and `bun run build` for implementation changes. Run
`bun run test:e2e` when changing the admin UI or OAuth consent, `bun run build:binary`
when changing packaging, and `bun run docs:check` for docs.
Add meaningful tests for protocol behavior, time calculations, state isolation,
and lifecycle changes as those features are implemented.

Use Bun's built-in test runner and co-locate tests as `*.test.ts` or
`*.test.tsx`. Test observable behavior and contracts, not implementation details.
Do not add a test only because a file changed. See
[apps/docs/src/content/docs/testing.mdx](apps/docs/src/content/docs/testing.mdx) for the test layers.
