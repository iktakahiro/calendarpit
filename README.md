# Calendarpit

A local calendar service for development and repeatable tests. Build calendar
integrations without a real Google account, provider credentials, or an external
database.

**Status: the documented scope is implemented locally.** Includes user/calendar/event management,
Google-compatible event APIs and free/busy, local OAuth, watch notifications,
fixture/reset controls, and masked request history. Compatibility is intentionally
limited; unsupported features return explicit errors. See
[compatibility](apps/docs/src/content/docs/compatibility.mdx).

## Quick start

**0.9.0 distribution is being prepared; the packages, images, and Homebrew tap
are not published yet.** The following commands are the intended release interface.
Until publication, use the [development guide](docs/development.md).

With Node.js 22 or later:

```sh
npx @iktakahiro/calendarpit@0.9.0 serve
```

Or Docker:

```sh
docker run --rm -p 127.0.0.1:4173:4173 -v calendarpit-data:/data ghcr.io/iktakahiro/calendarpit:0.9.0
```

Or Homebrew after the tap is published:

```sh
brew install iktakahiro/tap/calendarpit
calendarpit serve
```

Open <http://127.0.0.1:4173>. The API, local OAuth, and admin UI share one origin.
No Google credentials, environment file, or external database is needed.
See [installation](apps/docs/src/content/docs/installation.mdx) for Compose,
project dependencies, standalone downloads, networking, and updates.

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

For reproducible custom data in a temporary session:

```sh
CALENDARPIT_DATABASE=:memory: CALENDARPIT_CONFIG="$PWD/fixtures/default.json" bun run dev
```

Use absolute fixture paths with workspace commands. Loading a fixture replaces
current data; reset always restores the startup fixture and clears credentials,
history and watch state. See [Fixtures](apps/docs/src/content/docs/fixtures.mdx) and [Test control API](apps/docs/src/content/docs/test-control.mdx).

## Data storage

Normal development and CLI runs save changes to `.calendarpit/calendarpit.sqlite`
relative to the application's working directory. With `bun run dev` or `bun run start`
from this repository, that is `apps/calendarpit/.calendarpit/calendarpit.sqlite`.
The startup log and **Settings → Test data → Storage** show the actual path.

```sh
# Temporary E2E session; no files are written
CALENDARPIT_DATABASE=:memory: bun run dev
bun run start -- --database :memory: --port 0

# Choose a persistent workspace (use an absolute path with workspace scripts)
bun run start -- --database "$PWD/.calendarpit/manual.sqlite"
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

## Commands

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

```sh
bun run build
bun apps/calendarpit/bin/calendarpit.ts --help
bun apps/calendarpit/bin/calendarpit.ts serve --port 4173

bun run build:binary
./apps/calendarpit/dist/bin/calendarpit --port 4173
```

The executable embeds the server, client JavaScript/CSS, icons, and Bun
runtime. It does not need `node_modules` or a separate asset directory at runtime.
The admin UI loads Roboto Mono from Google Fonts and falls back to
system fonts when unavailable. Calendar and OAuth operations remain local.
Compilation defaults to the build host. The release workflow builds and tests
macOS arm64/x64, Linux glibc arm64/x64, and Windows x64 artifacts. On Windows the output has an `.exe`
suffix.

The default bind address is `127.0.0.1`. Use `--host` explicitly to change it.
`CALENDARPIT_HOST` and `CALENDARPIT_PORT` provide environment defaults; CLI flags
win. Port `0` requests an available port, which is printed on startup. Source CLI
execution requires Bun and a completed build; `--help` and `--version` do not.

## Docker (optional)

Build a local image from a source checkout, or use the versioned GHCR image
after publication. The release workflow validates both Linux architectures.

```sh
docker build -t calendarpit:local .
docker run --rm -p 127.0.0.1:4173:4173 -v calendarpit-data:/data calendarpit:local
```

The container explicitly binds `0.0.0.0` inside its own network namespace; the
published host port above remains loopback-only. The runtime image runs as a
non-root user. The named volume preserves `/data/calendarpit.sqlite` across restarts.
Use `-e CALENDARPIT_DATABASE=:memory:` for a temporary container session.

## Development conventions

Use English for source, comments, documentation, issues, and commit messages.
Keep protocol behavior independent from UI components and application consumers.
Chronock is the first integration target; it contributes no application-specific
data or logic to Calendarpit. See [AGENTS.md](AGENTS.md) for repository guidance.

CI runs protocol/CLI and Google SDK HTTP integration tests. The separate release
workflow builds and tests distribution artifacts, then publishes version tags
to npm, GHCR, and GitHub Releases. Homebrew updates require tap credentials.
See [Releasing](docs/releasing.md) for initial setup and publication status.
