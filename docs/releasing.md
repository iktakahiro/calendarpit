# Releasing Calendarpit

The first prepared release is **0.9.0**. Preparing artifacts does not publish
them. Initial npm publication, a public GHCR package, and the Homebrew tap still
need account setup and a successful release run. Keep the availability notices
in README and both documentation locales until those channels are verified.

## Names and version source

- npm launcher: `@iktakahiro/calendarpit`.
- Native npm packages: `@iktakahiro/calendarpit-{darwin-arm64,darwin-x64,linux-arm64,linux-x64,win32-x64}`.
- Container: `ghcr.io/iktakahiro/calendarpit`.
- GitHub release: `iktakahiro/calendarpit`, tag `v0.9.0`.
- Homebrew: `iktakahiro/homebrew-tap`, formula `Formula/calendarpit.rb`;
  installed with `brew install iktakahiro/tap/calendarpit`.

`packages/server/package.json` owns the version reported by the CLI and health
endpoint. Keep `apps/calendarpit/package.json` equal to it. Packaging validates
the two versions and the tag. Also update versioned installation examples,
`compose.yaml`, and the packaged npm README. Keep the release stage `preview`
until a deliberate 1.0 compatibility decision.

## Build and verify without publishing

```sh
bun install --frozen-lockfile
bun run validate
bun run build:binary
bun run smoke
bun run release:package
bun run release:assemble --local
bun run smoke:npm
docker build -t calendarpit:local .
bun run smoke:docker
docker compose config --quiet
bun run docs:check
```

Builds, package assembly, tests, and type checks use Bun. The npm CLI is used
only to verify the npm consumer installation and publish with npm authentication.
No dependency-age exclusions or lifecycle download scripts are needed. Consumer
smoke checks use local tarballs offline with install scripts disabled.

`dist/release/` under the app contains generated package directories and release
artifacts. `--local` assembles only the launcher and checksums for local testing;
it deliberately does not produce a publishable full release or Homebrew formula.
Normal assembly requires all five native archives and npm tarballs. The archive
contains `bin/calendarpit` (or `.exe`), a README, and LICENSE.

For full validation, dispatch `.github/workflows/release.yml` with `publish=false`.
It runs the full test suite, browser E2E, and docs checks, then builds and executes
each native binary and npm package on its matching OS/CPU. Linux amd64 and arm64
also build and test the Docker image. The `release` workflow artifact contains
the npm tarballs, standalone archives, `calendarpit.rb`, and `SHA256SUMS`.

Cross-compilation is available for local inspection after building the app:

```sh
bun apps/calendarpit/scripts/build-binary.ts --platform linux-x64
bun run release:package linux-x64
```

Each compile replaces `dist/bin/calendarpit`; package it before building the next
target. Native CI checks, not successful cross-compilation, determine support.
Linux packages target glibc; use the Debian-based container on musl hosts.

## Authentication and first publication

### npm

Log in as the owner of the scope; do not put credentials in source or chat:

```sh
npm login
npm whoami
```

The result must be `iktakahiro`, or an account explicitly authorized to publish
the scope. All six packages are public. Download the validated `release` artifact,
place its contents in `apps/calendarpit/dist/release/artifacts`, and verify
`SHA256SUMS` before the first publish. The publication helper publishes native
packages first and the launcher last:

```sh
bun apps/calendarpit/scripts/publish-npm.ts
```

Complete any npm 2FA prompts interactively. For subsequent releases, configure
a Trusted Publisher on **each** of the six packages:

- GitHub owner: `iktakahiro`
- Repository: `calendarpit`
- Workflow: `release.yml`
- Environment: `release`
- Allow direct `npm publish`.

The workflow uses Node 24 and npm's OIDC authentication with provenance. An
environment secret named `NPM_TOKEN` is an optional bootstrap fallback; prefer
Trusted Publishing after setup. Never weaken the account's 2FA requirement to
make a workflow run. See [npm Trusted Publishers](https://docs.npmjs.com/trusted-publishers/).

### GitHub and GHCR

The workflow's `GITHUB_TOKEN` has release and package write permission. No local
Docker login is required for CI publishing. Create the `release` environment and
configure its reviewers if desired. The image is linked to this repository by
its OCI source label. After first push, ensure its package visibility is **public**
and verify an anonymous pull. Repository visibility does not automatically prove
package visibility. See [GitHub Container registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry).

### Homebrew

Create the public `iktakahiro/homebrew-tap` repository with an initial README and
default branch. The generated formula downloads checksummed release executables
for macOS and Linux; it does not compile on the user's machine.

For automatic updates, set repository variable `HOMEBREW_TAP_ENABLED=true` and
environment secret `HOMEBREW_TAP_TOKEN` to a fine-grained token with contents write
access only to the tap repository. The release job updates the tap after GitHub
Releases is public. Alternatively, review and copy the generated formula into
the tap manually. Creating a tap is independent of admission to Homebrew core.

Before advertising the tap, verify `brew install iktakahiro/tap/calendarpit`,
`brew test iktakahiro/tap/calendarpit`, and a server startup on supported Macs.
See [maintaining a tap](https://docs.brew.sh/How-to-Create-and-Maintain-a-Tap).

## Publish a reviewed version

Commit and push only when explicitly authorized under AGENTS.md. Once the release
commit has passed CI, create and push its matching version tag. A `v*` tag triggers
the release workflow. A manual run with `publish=true` must select that version
tag; selecting `main` fails tag validation before publication.

The workflow publishes only after all validation jobs succeed. It uploads files
to a draft GitHub release, publishes native npm packages before the launcher,
pushes the two-architecture image and `latest` alias, makes the GitHub release
public, then optionally updates the Homebrew tap. Use exact version tags in docs
and CI; `latest` is a convenience alias. npm and GHCR publication are not atomic.

If publication partially fails, rerun the failed job using the **same workflow
artifacts**. The npm helper skips an existing version only when its registry
integrity matches the exact tarball. It rejects a changed tarball under the same
version. Never rebuild and overwrite a published version. Do not automatically
delete published packages to recover. The release job refuses to overwrite a
GitHub release that is already public. A failed Homebrew update can be retried
on its own or applied manually from the verified formula.

## Verify the published experience

1. Use a clean directory to run `npx @iktakahiro/calendarpit@0.9.0 --version`, then
   start the server and check `/__calendarpit/health` and the admin UI.
2. Install as an exact dev dependency with npm and run the CLI from an npm script.
3. Pull the versioned GHCR image without authentication, then test `compose.yaml`,
   restart persistence, and `:memory:`. Verify both image architectures.
4. Install through the Homebrew tap and run `--version` and a server startup.
5. Download an archive, verify SHA-256, extract it, and run without Bun or Node.
6. Test a containerized consumer with separate browser/backend OAuth addresses
   and an explicitly allowed watch receiver hostname.
7. Remove the pending-publication notices in README, installation, quick start,
   scope, and both locales only after the relevant channels pass verification.

Upgrades must preserve the existing SQLite format and reset baseline. Stop the
server and back up its data before upgrade tests. Do not add a background Homebrew
service by default: foreground execution keeps state local to each project.
