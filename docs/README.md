# Contributor documentation

The documentation site in `apps/docs` is for people who use Calendarpit. These
pages are for people who change it.

- [Development](development.md): setup, contributor commands, checks, CI, packaging, and conventions.
- [Architecture](architecture.md): workspace boundaries, runtime choices, and distribution.
- [Testing](testing.md): test layers, helpers, and conventions.
- [Releasing](releasing.md): Docker, GitHub Releases, Homebrew, and authentication.
- [Site deployment](site-deployment.md): publish the static site on Cloudflare.
- [Roadmap](roadmap.md): implemented workflows and remaining integration and release work.

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

[Architecture](architecture.md) describes what each workspace owns.
