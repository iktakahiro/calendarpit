# Site deployment

Internal maintainer notes. This file and `apps/docs/cloudflare/zone-rules.json`
are not included in the public site artifact. Do not copy infrastructure or
security configuration into `apps/docs/src/content/docs`.

The production origin is **https://calendarpit.dev**, without `www`. English
pages start at `/`; Japanese pages start at `/ja/`. The site is built from
`apps/docs` with Bun and published on Cloudflare Workers.

## Deployment units

- `apps/docs/wrangler.jsonc` deploys `calendarpit-site`, a static-assets-only
  Worker for `calendarpit.dev`. Only `apps/docs/dist` is uploaded. HTML uses
  trailing slashes and missing pages return `404.html` with HTTP 404.
- `www.calendarpit.dev` uses a zone-level Single Redirect rule: HTTP 301 to
  `https://calendarpit.dev`, preserving the path and query string. A proxied
  `A` record pointing to `192.0.2.1` brings requests to the redirect rule.
  There is no redirect Worker and the placeholder is not an origin server.
- The site configuration disables `workers.dev` and preview URLs. Its Custom
  Domain provisions the apex DNS record and certificate during deployment.

## Zone rules

`apps/docs/cloudflare/zone-rules.json` records the intended zone configuration
for maintainer review and recovery. It is not a Wrangler input and is not
automatically applied by the site deployment workflow. Manage these rules through
the Cloudflare dashboard or an authorized Rulesets API connection; preserve any
unrelated rules when updating an existing phase.

- Single Redirect: `www.calendarpit.dev` to the HTTPS apex, HTTP 301, preserving
  the path and query string.
- Custom WAF: block sensitive-file probing, including encoded or mixed-case
  requests for `.git`, `.env`, SSH/AWS credentials, process environment data,
  and container secrets.
- Rate limit: 300 requests per 10 seconds per source IP and Cloudflare location,
  with a 10-second block. Verified bots, `/cdn-cgi/`, `/assets/`, and common
  static asset extensions are excluded. No application-specific webhook or
  API exceptions are needed for this static site.

The zone may also carry account-level rules that are managed only in the
Cloudflare dashboard and are not recorded here. Review the live phase before
replacing it from this file.

The API, OAuth server, SQLite database, and admin UI remain local Calendarpit
runtime features. They are not part of the public site deployment.

## Validate without publishing

From the repository root:

```sh
bun install --frozen-lockfile
bun run docs:deploy:check
```

This fixes the build origin and base path to `https://calendarpit.dev/`, builds
both locales, checks types, links, and metadata, then runs a Wrangler dry run
for the static site. It requires no Cloudflare token
and does not change DNS or publish assets. CI runs the same check.

For a static preview:

```sh
bun run --cwd apps/docs preview
```

Open `http://127.0.0.1:4488/` or `http://127.0.0.1:4488/ja/`. To exercise Cloudflare's
actual local asset routing instead, run:

```sh
bun run --cwd apps/docs wrangler dev --ip 127.0.0.1 --port 4489
```

## Automatic production deployment

The Git integration was configured on October 19, 2026. Automatic builds are
enabled for `main`, and previews are disabled.

1. Use the Cloudflare account containing the active `calendarpit.dev` zone.
   Ensure the apex is not assigned to an unrelated service. Let Wrangler
   provision its Custom Domain; retain the separate proxied `www` record and
   zone rules described above.
2. Connect `iktakahiro/calendarpit` to `calendarpit-site` through Cloudflare
   Workers Builds using the Cloudflare Workers and Pages GitHub App. Scope
   repository access to Calendarpit. Cloudflare manages build authentication;
   no Cloudflare API token or deployment environment is needed in GitHub Actions.
3. Configure Workers Builds with these settings:

   | Setting                                  | Value                                                             |
   | ---------------------------------------- | ----------------------------------------------------------------- |
   | Production branch                        | `main`                                                            |
   | Root directory                           | `apps/docs`                                                       |
   | Build command                            | `cd ../.. && bun install --frozen-lockfile && bun run docs:check` |
   | Deploy command                           | `bun run deploy`                                                  |
   | Preview/non-production builds            | Disabled                                                          |
   | Build watch paths                        | All paths (`*`)                                                   |
   | Build variable `BUN_VERSION`             | `1.4.3` (keep in sync with `.bun-version`)                        |
   | Build variable `SKIP_DEPENDENCY_INSTALL` | `true`                                                            |
   | Build variable `DOCS_BASE_PATH`          | `/`                                                               |
   | Build variable `DOCS_SITE_URL`           | `https://calendarpit.dev`                                         |

   Install from the repository root so Bun uses the committed lockfile and
   `bunfig.toml` release-age gate. The build command runs the documentation
   validation through Turborepo before Cloudflare runs the deploy command.

4. After the deployment configuration is committed and pushed, every update to
   `main`, including a merged pull request, starts a build in Cloudflare.
   Failed build or validation prevents deployment. Other branches do not deploy.
   Retry builds from the Cloudflare dashboard. GitHub Actions validates pull
   requests and `main`; it does not publish the site. Zone rules are managed
   separately.

For an authenticated local deployment, export `CLOUDFLARE_ACCOUNT_ID` and
`CLOUDFLARE_API_TOKEN` securely, then run:

```sh
bun run docs:deploy
```

Use the root command: it enforces the production origin/base path and validates
the artifact before upload. Wrangler is pinned in the Bun lockfile;
do not use an unpinned CLI or bypass the dependency release-age gate.

## Verify the published site

After DNS and certificate provisioning completes:

```sh
curl -I https://calendarpit.dev/
curl -I https://calendarpit.dev/ja/
curl -I https://calendarpit.dev/quick-start
curl -I https://calendarpit.dev/a-page-that-does-not-exist/
curl -I 'https://www.calendarpit.dev/ja/quick-start/?from=www'
```

Expect HTTP 200 for the home pages, a redirect to `/quick-start/`, HTTP 404 for
the unknown path, and HTTP 301 with
`Location: https://calendarpit.dev/ja/quick-start/?from=www` for the `www` request.
Also check language switching and navigation in the in-app browser. Canonical
and alternate-language links must use the apex origin.

Site deployment does not replace zone rules. Roll back the site Worker in
Cloudflare's deployment history when necessary; review zone rules independently.

References: [Static assets](https://developers.cloudflare.com/workers/static-assets/),
[Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/),
and [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/).
