# Calendarpit

A local Google Calendar-compatible API and OAuth server for development and
repeatable tests. Includes a browser admin UI and SQLite persistence. No Google
account, credentials, or external database is required.

```sh
npx @iktakahiro/calendarpit@0.9.0 serve
```

Open http://127.0.0.1:4173. Data is saved in
`.calendarpit/calendarpit.sqlite` in your current directory.

```sh
npx @iktakahiro/calendarpit@0.9.0 serve --database :memory: --port 4173
```

Node.js 22 or later is required for the npm launcher. The server includes its own
Bun runtime; a separate Bun installation is unnecessary. Supported platforms:
macOS arm64/x64, Linux glibc arm64/x64, and Windows x64. Use Docker on Alpine/musl
and other unsupported hosts. Keep optional dependencies enabled. Installation
does not use postinstall scripts or download executable code outside npm.

For a project, install with `npm install --save-dev --save-exact @iktakahiro/calendarpit@0.9.0`
and add `"calendar": "calendarpit serve"` to your package scripts.

The API deliberately implements a documented subset of Google Calendar. Unsupported
features return explicit errors. Calendarpit is intended for local development and
tests; the admin and test-control endpoints have no authentication.

[Documentation](https://iktakahiro.github.io/calendarpit/)
· [Source and issues](https://github.com/iktakahiro/calendarpit)
