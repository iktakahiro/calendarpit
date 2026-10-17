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
- Treat `apps/docs/mvp.mdx` as the product scope; distinguish implemented behavior from planned behavior.
- Explicitly reject unsupported API features. Never silently degrade a recurring event into a single event.
- Keep runtime assets local except for the admin UI's Roboto Mono font, which loads from Google Fonts with system-font fallbacks. Calendar and OAuth behavior must not require real Google credentials or network access to Google.
- Bind to loopback by default. A non-loopback host must be explicitly configured.
- Use the 1Password MCP server for any work with 1Password developer environments.
- Use the built-in in-app browser (`iab`) for browser interaction unless another browser is explicitly requested.
- Stay on `main` during initial setup. Do not create commits unless the user asks.
- For authorized commits, follow [.agents/skills/commit/SKILL.md](.agents/skills/commit/SKILL.md) and use English Conventional Commits. Push only when explicitly requested.

## Validation

Run `bun run validate` and `bun run build` for implementation changes. Run
`bun run build:binary` when changing packaging and `bun run docs:check` for docs.
Add meaningful tests for protocol behavior, time calculations, state isolation,
and lifecycle changes as those features are implemented.
