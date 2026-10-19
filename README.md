<h1>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="apps/docs/src/assets/logo-dark.svg">
    <img src="apps/docs/src/assets/logo-light.svg" alt="Calendarpit" height="32">
  </picture>
</h1>

A local calendar service for development and repeatable tests. Build calendar
integrations without a real Google account, provider credentials, or an external
database.

**Status: the documented scope is implemented locally.** Includes user/calendar/event management,
Google-compatible event APIs and free/busy, local OAuth, watch notifications,
fixture/reset controls, and masked request history. Compatibility is intentionally
limited; unsupported features return explicit errors. See
[compatibility](apps/docs/src/content/docs/compatibility.mdx).

## Quick start

Calendarpit **0.9.4** is available through Docker, Homebrew, and
[GitHub Releases](https://github.com/iktakahiro/calendarpit/releases/tag/v0.9.4).

With Docker:

```sh
docker run --rm -p 127.0.0.1:4173:4173 -v calendarpit-data:/data ghcr.io/iktakahiro/calendarpit:0.9.4
```

Or Homebrew:

```sh
brew install iktakahiro/tap/calendarpit
calendarpit serve
```

Open <http://127.0.0.1:4173>. The API, local OAuth, and admin UI share one origin.
No Google credentials, environment file, or external database is needed.
See [installation](apps/docs/src/content/docs/installation.mdx) for Compose,
standalone downloads, networking, and updates.

Contributor setup, including the docs preview, lives in [docs/](docs/README.md).

## Try a calendar integration

From a source checkout prepared using the [development guide](docs/development.md),
in another terminal:

```sh
bun run sample:dev
```

Open <http://127.0.0.1:4175>, connect a calendar, and approve a test user. Create an
event, inspect busy intervals, start a watch, update/delete events, and revoke and
reconnect. The default sample date is **October 19, 2026**. The admin UI polls for
external changes every two seconds.

The built-in test client is `sample-app` / `local-sample-secret`, with callback
`http://127.0.0.1:4175/callback`. The sample overrides authorization, token, user-info,
Calendar API, and revocation endpoints and blocks real Google requests. See
[Connect your app](apps/docs/src/content/docs/connect.mdx) for consuming-app configuration.

Save the JSON example from [Fixtures](apps/docs/src/content/docs/fixtures.mdx) as
`calendarpit.fixture.json`, then start a temporary session from that directory:

```sh
calendarpit serve --database :memory: --config ./calendarpit.fixture.json
```

Relative fixture paths resolve from the directory where you start the CLI. Loading a fixture replaces
current data; reset always restores the startup fixture and clears credentials,
history and watch state. See [Fixtures](apps/docs/src/content/docs/fixtures.mdx) and [Test control API](apps/docs/src/content/docs/test-control.mdx).

## Data storage

Homebrew and standalone CLI runs save changes to
`.calendarpit/calendarpit.sqlite` in the directory where you start Calendarpit.
Run from your project directory, or pass an explicit database path.
The startup log and **Settings → Test data → Storage** show the actual path.

```sh
# Temporary E2E session; no database files are written
calendarpit serve --database :memory: --port 0

# Choose a persistent workspace
calendarpit serve --database ./.calendarpit/manual.sqlite
```

Existing databases reopen their saved data, connections, tokens, watch channels,
and bounded history. A fixture seeds only a new database; reset restores that
original baseline even after restarting. Loading a fixture replaces current data
without changing the baseline. Each parallel worker must use `:memory:` or its own
file. See [Storage and restarts](apps/docs/src/content/docs/storage.mdx).

## Connect your application

Point your existing Google SDK and OAuth flow at Calendarpit. See the docs for
[Local OAuth](apps/docs/src/content/docs/oauth.mdx) and
[SDK examples](apps/docs/src/content/docs/sdks.mdx) in TypeScript/JavaScript, Python, Go, Java,
C#, and HTTP/curl, including calendar lists and FreeBusy queries.

## Workspace

```text
apps/
  calendarpit/          React admin UI, TanStack Start, Bun CLI
  docs/                 User documentation site (English and Japanese)
  sample/               Separate Bun app using the official Google SDK
packages/
  server/               Framework-independent API boundary and server logic
  typescript-config/    Shared strict TypeScript settings
```

Contributor documentation (architecture, testing, development workflow) lives in
[`docs/`](docs/README.md).

The UI uses React 19, TanStack Start/Router, Kumo, Tailwind CSS 4, and Gravity
UI Icons. TanStack Form manages the event editor. Bun provides the
runtime, package manager, type checker, test runner, and executable compiler.
Turborepo orchestrates workspace tasks; Oxlint and Oxfmt provide linting and
formatting. Direct dependency versions and `bun.lock` are pinned.

New dependency resolutions require a minimum release age of 48 hours via
`bunfig.toml`. npm-check-updates uses the matching two-day cooldown in
`.ncurc.json`. Existing locked versions are not re-evaluated by this policy.

## Contributor commands

These commands require a source checkout and the [development setup](docs/development.md).

| Command                        | Purpose                                                         |
| ------------------------------ | --------------------------------------------------------------- |
| `bun run dev`                  | Local API/admin development server with HMR                     |
| `bun run sample:dev`           | Separate Google SDK consumer at port 4175                       |
| `bun run docs:dev`             | Documentation preview                                           |
| `bun run validate`             | Lint, format check, `bun check`, and Bun tests                  |
| `bun run fix`                  | Apply lint and formatting fixes                                 |
| `bun run build`                | Build the admin client and server                               |
| `bun run start -- --port 4175` | Start the built application on a custom port                    |
| `bun run build:binary`         | Build and compile a standalone executable for the host platform |
| `bun run smoke`                | Verify the compiled executable in an isolated directory         |
| `bun run docs:check`           | Validate documentation                                          |

## CLI and executable

After installing with Homebrew or placing a standalone executable on your `PATH`:

```sh
calendarpit --help
calendarpit --version
calendarpit serve --port 4173 --database :memory:
```

Homebrew and standalone downloads run the same embedded executable.
It includes the server, admin UI assets, and Bun runtime. No separate Node.js
or Bun installation is needed. Calendarpit is not distributed through npm.
Releases target macOS arm64/x64, Linux glibc arm64/x64, and Windows x64.
See [installation](apps/docs/src/content/docs/installation.mdx) for downloads,
checksums, and upgrades, and [Run and configure](apps/docs/src/content/docs/running.mdx)
for all flags and environment variables.

The default bind address is `127.0.0.1`. Use `--host` explicitly to change it.
CLI flags take precedence over `CALENDARPIT_*` environment variables. Port `0`
requests an available port, which is printed on startup. The admin UI loads
Roboto Mono from Google Fonts with system-font fallbacks; Calendar and OAuth
operations remain local.

## Docker Compose

Add this service to your project's `compose.yaml`:

```yaml
services:
  calendarpit:
    image: ghcr.io/iktakahiro/calendarpit:0.9.4
    ports:
      - '127.0.0.1:4173:4173'
    volumes:
      - calendarpit-data:/data

volumes:
  calendarpit-data:
```

```sh
docker compose up -d calendarpit
docker compose logs calendarpit
docker compose down
```

The container binds `0.0.0.0` internally and runs as a non-root user. The host
port stays on loopback. The named volume preserves `/data/calendarpit.sqlite`;
`docker compose down -v` deletes it. Use `CALENDARPIT_DATABASE=:memory:` for
disposable tests. Browsers use `http://127.0.0.1:4173`; another Compose service
uses `http://calendarpit:4173`. See [installation](apps/docs/src/content/docs/installation.mdx)
for OAuth and webhook networking.

## Development conventions

Use English for source, comments, documentation, issues, and commit messages.
Keep protocol behavior independent from UI components and application consumers.
Chronock is the first integration target; it contributes no application-specific
data or logic to Calendarpit. See [AGENTS.md](AGENTS.md) for repository guidance.

CI runs protocol/CLI and Google SDK HTTP integration tests. The separate release
workflow builds and tests distribution artifacts, then publishes version tags
to GHCR and GitHub Releases. Homebrew updates require tap credentials.
See [Releasing](docs/releasing.md) for initial setup and publication status.
