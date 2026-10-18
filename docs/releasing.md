# Releasing Calendarpit

Calendarpit is distributed through Docker, Homebrew, and standalone GitHub
Release archives. There is no supported npm distribution.

## Names and version source

- Container: `ghcr.io/iktakahiro/calendarpit`.
- GitHub release: `iktakahiro/calendarpit`, tag `v0.9.0`.
- Homebrew: `iktakahiro/homebrew-tap`, formula `Formula/calendarpit.rb`;
  installed with `brew install iktakahiro/tap/calendarpit`.

`packages/server/package.json` owns the version reported by the CLI and health
endpoint. Keep `apps/calendarpit/package.json` equal to it. Packaging validates
the two versions and the tag. Update versioned installation examples and
`compose.yaml` together. Keep the release stage `preview` until a deliberate
1.0 compatibility decision.

## Build and verify without publishing

```sh
bun install --frozen-lockfile
bun run validate
bun run build:binary
bun run smoke
bun run release:package
bun run release:assemble --local
docker build -t calendarpit:local .
bun run smoke:docker
docker compose config --quiet
bun run docs:check
```

Builds, packaging, tests, and type checks use Bun. `dist/release/` under the app
contains generated archives and release metadata. Use a clean artifact directory.
`--local` writes checksums for local testing; it does not produce a complete
release or Homebrew formula. Full assembly requires all five native archives.
Each archive contains `bin/calendarpit` (or `.exe`), a README, and LICENSE.

For full validation, dispatch `.github/workflows/release.yml` with `publish=false`.
It runs the full suite, browser E2E, and docs checks, then builds and runs each
native binary on its matching OS/CPU. Linux amd64 and arm64 also build and test
the Docker image. The `release` workflow artifact contains five standalone
archives, `calendarpit.rb`, and `SHA256SUMS`.

Cross-compilation is available for local inspection after building the app:

```sh
bun apps/calendarpit/scripts/build-binary.ts --platform linux-x64
bun run release:package linux-x64
```

Each compile replaces `dist/bin/calendarpit`; package it before building the next
target. Native CI checks determine support. Linux executables require glibc;
use the Debian-based container on musl hosts.

## Authentication

### GitHub and GHCR

The workflow's `GITHUB_TOKEN` has release and package write permission. No local
Docker login is required. The `release` environment can have required reviewers.
The image is linked to this repository through its OCI source label. After the
first push, make the package **public** and verify an anonymous pull. Repository
visibility does not automatically set package visibility.

### Homebrew

The public `iktakahiro/homebrew-tap` repository holds the formula. It downloads
checksummed release executables rather than compiling on the user's machine.

For automatic updates, set repository variable `HOMEBREW_TAP_ENABLED=true` and
environment secret `HOMEBREW_TAP_TOKEN` to a fine-grained token with contents write
access only to the tap repository. Alternatively, copy the generated formula
into the tap, review it, commit, and push after the GitHub release is public.
The first release uses this manual tap update, so no persistent tap token is
needed. Creating a tap is independent of admission to Homebrew core.

## Publish a reviewed version

Commit and push only when authorized under AGENTS.md. Once the release commit
passes CI, create and push its version tag. A `v*` tag triggers the release
workflow. A manual run with `publish=true` must select that version tag.

The workflow uploads the verified archives to a draft GitHub release, pushes
the two-architecture container image and `latest` alias, makes the GitHub release
public, then optionally updates the tap. Use exact version tags in docs and CI.

If publication fails, rerun the failed job using the same artifacts. Never
silently replace a public release or rebuild and overwrite its assets.
`.github/workflows/publish-prepared.yml` can resume an existing reviewed draft
from `main`: supply its version tag. It validates the draft's complete archive
checksums, builds and smoke-tests each container on its native CPU runner from
the existing tag, combines the image manifests, and publishes the draft.
It does not build native archives, publish npm packages, or update the tap.
Update the tap separately after this recovery workflow succeeds.

## Verify the published experience

1. Download an archive, verify SHA-256, extract, and run without Bun or Node.
2. Pull the versioned GHCR image without authentication and verify both image
   architectures. Test Compose, restart persistence, and `:memory:` sessions.
3. Install with `brew install iktakahiro/tap/calendarpit`, run `brew test
   iktakahiro/tap/calendarpit`, and verify server startup.
4. Test container networking with separate browser/backend OAuth addresses and
   an explicitly allowed watch receiver hostname.
5. Remove pending-publication notices from README and both docs locales only
   after the corresponding channels pass verification.

Stop the server and back up its database before upgrades. Preserve the SQLite
format and reset baseline. Do not add a background Homebrew service by default:
foreground execution keeps state local to each project.
