---
name: commit
description: Prepare and create task-scoped Conventional Commits in Calendarpit.
---

# Commit

Adapted from Chronock's repository commit workflow for Calendarpit's workspaces
and validation commands.

## Pre-commit checks

Follow the [root validation policy](../../../AGENTS.md#validation). Reuse successful
checks when they cover the final content; rerun checks affected by later changes.
Use Calendarpit's root scripts rather than copying commands from another repository:

- `bun run validate` and `bun run build` for implementation changes.
- `bun run build:binary` and `bun run smoke` for CLI or packaging changes.
- `bun run docs:check` for documentation changes.
- `bun run format` for skill or repository guidance changes; verify their local links.

Fix task-caused failures before committing. If blocked, report the failed check and
leave the changes uncommitted.

## Commit messages

Use English [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):

```text
<type>[optional scope][!]: <description>

[optional body]

[optional footers]
```

Use `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `build`, `ci`, `perf`, or
`revert`. Choose a short imperative description without a trailing period. Use a
scope when it clarifies the change: `server`, `calendarpit`, `sample`, `docs`, or
`repo`. Mark incompatible changes with `!` and explain them in a `BREAKING CHANGE:`
footer.

Examples:

- `feat(server): support incremental event synchronization`
- `fix(calendarpit): preserve the appearance cookie during navigation`
- `docs: explain local Google SDK configuration`
- `chore(repo): add the Conventional Commit workflow`

## Delivery

- Inspect `git status`, the working-tree diff, untracked task files, and the staged
  diff before committing. Stage explicit task paths. Include unrelated changes
  only when the user requested that scope.
- Group commits by independent intent. One coherent feature can be one commit;
  separate independent documentation and tooling changes. Keep dependencies and
  `bun.lock` together, preserving exact versions and the release-age gate.
- Never stage generated builds, local SQLite databases, credentials, or runtime logs.
- Follow the user's branch instructions. Stay on `main` during initial setup;
  creating a commit does not authorize creating or switching branches.
- When committing is authorized, commit directly without another confirmation.
  Do not amend existing commits unless requested.
- Verify the resulting history and working tree, then summarize the commit hashes,
  subjects, validation results, and any remaining changes.
- Push or create a pull request only when explicitly requested. A commit request
  alone does not authorize either action. Respect explicit no-push limits.
