# Development

Run, validate, and package Calendarpit with Bun.

## Prerequisites

Use Bun 1.4.3, pinned in `.bun-version` and the root `packageManager` field.
This version includes the native `bun check` type checker. No external database,
Google account, secrets, or environment file is needed for local use.

```sh
git clone https://github.com/iktakahiro/calendarpit.git
cd calendarpit
bun install --frozen-lockfile
bun run dev
```

The admin UI and API listen at `http://127.0.0.1:4173`. Development uses Vite
running on Bun. Production uses `Bun.serve` in a single process. Both default to
SQLite persistence in `apps/calendarpit/.calendarpit/calendarpit.sqlite` when using
workspace scripts. Use `CALENDARPIT_DATABASE=:memory: bun run dev` for disposable
data, or `bun run start -- --database :memory:` after building. Server hot reloads
close the previous workspace before reopening the saved database.

`bun run dev` always binds to `127.0.0.1:4173` with a strict port check.
It does not accept Calendarpit CLI flags, `CALENDARPIT_HOST`, or `CALENDARPIT_PORT`;
use the built CLI for a custom host or port. The dev server passes through
`CALENDARPIT_DATABASE`, `CALENDARPIT_CONFIG`, and `CALENDARPIT_WATCH_HOSTS`.
Workspace commands run from `apps/calendarpit`, so use absolute fixture paths
such as `CALENDARPIT_CONFIG="$PWD/fixtures/default.json" bun run dev` when invoking
them from the repository root.

Run `bun run docs:dev` for the documentation preview at
`http://127.0.0.1:4487/`. The docs use TanStack Start, Fumadocs, and MDX.
`bun run docs:check` builds it and fails on broken internal links or anchors.
Cloudflare Workers Builds watches `main` and builds and deploys the site after
updates, including merged pull requests. GitHub Actions only validates the site.
See [Site deployment](site-deployment.md) for Git integration and first publication.
The preview does not open an external browser automatically.

## Checks

### Dependency release interval

`bunfig.toml` sets `install.minimumReleaseAge = 172800` (48 hours) for new
dependency resolutions, including transitive dependencies. `.ncurc.json` sets
the matching two-day `cooldown` for npm-check-updates and preserves exact versions.
Keep both settings aligned. Do not disable the gate, lower the interval, or add
package exclusions without explicit approval.

The age filter does not re-evaluate versions already recorded in `bun.lock`.
CI uses `bun install --frozen-lockfile` to reproduce the reviewed dependency set.
This delay is a supply-chain buffer, not a guarantee that a package is safe.

### Validation commands

```sh
bun run validate
bun run build
bun run test:e2e
bun run docs:check
```

`validate` runs Oxlint, Oxfmt, workspace type checks using `bun check`, and Bun
tests. `bun run fix` applies formatting and lint fixes. The API package is tested
without starting a UI server. CLI tests cover bind defaults, argument parsing,
and asset serving.

`test:e2e` builds the app and runs the Playwright browser tests in
`apps/calendarpit/e2e` against the production server with an in-memory
database. Install the browser once with
`bun run --cwd apps/calendarpit playwright install chromium`.

Do not create a package script named `check` that obscures Bun's native command.
Use `type-check` for type checking and `validate` for the aggregate checks.

## Production and packaging

```sh
bun run build
bun run start
bun run build:binary
bun run smoke
```

The executable is written to `apps/calendarpit/dist/bin/calendarpit` (with `.exe`
on Windows). Client assets are embedded with Bun's file loader. The smoke check
copies the executable into a temporary directory with a test fixture, starts it
on an available loopback port, and checks config loading, HTML, assets, the
health endpoint, and explicit API errors. It also verifies recovery after a forced
process exit, memory-mode isolation, and reset persistence across restarts. No source
or node_modules are needed.

Use `--host`, `--port`, `--database`, `--help`, and `--version` on the CLI. Environment defaults
are `CALENDARPIT_HOST` and `CALENDARPIT_PORT`; command-line flags take precedence.
The default host is `127.0.0.1` and the default port is `4173`.

### Optional Docker setup

Use Bun directly for day-to-day development. Build and validate the container with:

```sh
docker build -t calendarpit:local .
bun run smoke:docker
docker run --rm -p 127.0.0.1:4173:4173 -v calendarpit-data:/data calendarpit:local
```

The Docker build compiles for the container's platform. See [Releasing](releasing.md)
for cross-platform artifacts, GHCR, and Homebrew publication.

### Optional consumer sample

With Calendarpit running on port 4173, run `bun run sample:dev` from the checkout.
Open `http://127.0.0.1:4175` and connect a test calendar, create an event, inspect
FreeBusy, start watch notifications, and revoke/reconnect. The sample uses public
local test credentials `sample-app` / `local-sample-secret` and callback
`http://127.0.0.1:4175/callback`. No real Google requests are needed.

## Generated files

TanStack Start generates `src/routeTree.gen.ts`. Keep the generated route tree
with the source so type checking works before the first build. Do not edit it
manually. Build output, Turbo caches, and generated executable entry files are
ignored by Git, linting, and formatting.

## Documentation site

`apps/docs` holds the user-facing documentation and landing pages, built with
TanStack Start, Fumadocs UI, and MDX. Every English and Japanese page is
prerendered at build time. Deploy only `apps/docs/dist`: it contains HTML,
CSS, JavaScript, and local assets, with no server bundle, server functions,
or search service. Search is intentionally disabled, including client search.
The build-time renderer does not run in production.

- English pages live in `apps/docs/src/content/docs/`. Japanese pages use the
  same filename under `ja/`, with identical code blocks. English has no locale
  prefix; Japanese uses `/ja/`. Contributor material stays in this `docs/` folder.
- `src/site/source.ts` uses Fumadocs MDX's async macro collection and source
  loader for schema validation, lazy content, and navigation. Each locale's
  `meta.json` defines sidebar order and structure, and
  `src/site/navigation-tree.ts` builds it without moving files or changing
  URLs: `---Label---` is a group label, `---[Icon]Name---` opens a collapsible
  folder, and a bare `---` closes it. Page icons use the `icon` frontmatter
  field, both resolved from the allowlist in `src/site/navigation-icons.tsx`. The official Vite plugin
  handles compilation and content updates; there is no custom MDX parser/cache.
- `src/site/i18n.ts` configures the locales. Fumadocs supplies the language menu;
  `src/site/translations.ts` supplies Japanese UI labels. Add future languages
  to the locale configuration and translated content, rather than adding toggles.
- MDX uses the standard Fumadocs `Card`, `Tabs`/`Tab`, `Steps`/`Step`, callouts,
  and code blocks from `src/site/mdx-components.tsx`. Tabs use `forceMount` to keep
  inactive examples in generated HTML. Each page has its own JS chunk.
- Documentation typography, spacing, and colors use the Fumadocs preset. Google
  Fonts provides variable Geist for Latin text and Roboto Mono for code, both
  with system fallbacks. Japanese uses system fonts (Hiragino Sans, Yu Gothic,
  Meiryo). Body copy uses the light (300) weight.
- Custom branding and motion are confined to the landing page. Motion adapts
  MIT-licensed Magic UI components (`src/site/motion/`, notices in
  `apps/docs/THIRD_PARTY_NOTICES.md`): an animated hero grid, a workbench that
  settles flat on scroll, and card glows with scroll reveals. Hero entrances are
  CSS animations that start with the prerendered HTML; reduced motion turns all
  motion off.
- Each locale's `index.mdx` owns its landing content and hero frontmatter.
  `src/site/landing-hero.tsx` and `landing-diagram.tsx` render the introduction;
  diagram labels live in `src/components/landing/`.
- `bun run docs:check` builds, type-checks, and checks all rendered pages,
  internal links, anchors, assets, metadata, locale coverage, and code parity.
  `bun run --cwd apps/docs preview` serves **only static output** at
  `http://127.0.0.1:4488/`, including a real HTTP 404 for missing pages.
- `scripts/llms-text.ts` runs after the static build and writes `llms.txt`,
  `llms-full.txt`, and one `.md` file per page for each locale from the MDX
  sources and `meta.json` navigation. Callouts become GitHub alerts; other MDX
  components stay as JSX. Every page must appear in `meta.json`.
- The root `context7.json` limits Context7 indexing to the English pages in
  `apps/docs/src/content/docs`. Keep its `rules` in step with the docs when a
  behavior they describe changes. Setting `excludeFiles` turns off Context7's
  default file exclusions.
- TanStack Start generates `src/routeTree.gen.ts`; keep it in source control.
  The build cleans stale output and removes its temporary server bundle.

### Static hosting

The defaults are `DOCS_BASE_PATH=/` and
`DOCS_SITE_URL=https://calendarpit.dev`. Canonical and alternate-language URLs
use this apex origin. The Cloudflare deployment also redirects `www` to it.
See [Site deployment](site-deployment.md) for validation and publication.

For another static host, override both settings when building:

```sh
DOCS_BASE_PATH=/calendarpit/ DOCS_SITE_URL=https://example.com bun run docs:check
```

Set the same base path when running the static preview. No SSR worker or SPA
fallback is needed: every page has an `index.html`, and `404.html` handles
missing paths. MDX links use router paths without a deployment prefix.
`SiteLink` adapts Fumadocs links to TanStack Router's base path and separate
hash property, preserving prefixes and in-page anchors on both hosting layouts.
Turborepo includes both deployment settings in the docs build cache key.
