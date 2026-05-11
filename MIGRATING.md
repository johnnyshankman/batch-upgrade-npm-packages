# Migrating from 1.x to 2.0

`batch-upgrade-npm-packages` v2.0 is a breaking release. Most changes are flag layout and exit codes; the core upgrade workflow is unchanged.

See [`CHANGELOG.md`](./CHANGELOG.md) for the full list of changes.

## At a glance

| 1.x form                                         | 2.0 form                                                             |
| ------------------------------------------------ | -------------------------------------------------------------------- |
| `batch-upgrade-npm -p react -v ^18.0.0 -r ./app` | `batch-upgrade-npm upgrade -p react --versions ^18.0.0 -r ./app`     |
| `batch-upgrade-npm -p react -v ^18.0.0 -r ./app` | (legacy form still works with a deprecation warning until 3.0)       |
| (always-on confirmation)                         | `--yes` / `CI=true` / non-TTY auto-confirms; otherwise still prompts |
| (silently runs `git reset --hard`)               | Aborts with exit 5; pass `--reset-hard` to opt in                    |
| `-v` was `--versions`                            | `-v` is now `--verbose`; use long-only `--versions`                  |
| Hardcoded `main` base branch                     | Auto-detected per-repo; override with `-b/--base`                    |
| Exit codes 0/1 only                              | 0/1/2/3/4/5 — see Exit codes table in README                         |
| All output to stdout                             | Progress on stderr; data on stdout                                   |
| No JSON, no env vars, no completion              | `--json`, `BATCH_UPGRADE_*` env vars, `completion <shell>`           |
| Node.js 14+                                      | Node.js 18+                                                          |

## Two changes most likely to break existing scripts

### 1. `-v` is no longer `--versions`

In 1.x, `-v` was an alias for `--versions`. In 2.0, `-v` is `--verbose` (matching the universal CLI convention). Use the long-form `--versions` instead.

A one-line fix for existing CI scripts:

```bash
sed -i 's/ -v / --versions /g' your-ci-script.sh
```

### 2. Confirmation now requires `--yes` (or equivalent)

In 1.x, the tool ran with no confirmation. In 2.0, it prompts by default. Auto-confirm sources:

- `--yes` / `-y` flag
- `CI=true` env var
- non-TTY stdin
- `BATCH_UPGRADE_YES=true` env var

Existing CI scripts that piped `y` to stdin should now use `--yes` (or set `CI=true`).

```bash
# before
echo y | batch-upgrade-npm -p react -v ^18.0.0 -r ./app

# after
batch-upgrade-npm upgrade --yes -p react --versions ^18.0.0 -r ./app
# or
CI=true batch-upgrade-npm upgrade -p react --versions ^18.0.0 -r ./app
```

## New requirement: Node.js 18+

v2.0 drops support for Node 14 and 16. The CI matrix tests against 18, 20, and 22.

If you need Node 14 support, pin to the last 1.x release.

## New exit codes

1.x emitted only `0` (success) and `1` (failure). 2.0 expands to:

| Code | Meaning                                             |
| ---- | --------------------------------------------------- |
| `0`  | Success                                             |
| `1`  | One or more repositories failed                     |
| `2`  | Usage error (invalid flags or arguments)            |
| `3`  | GitHub CLI authentication failure                   |
| `4`  | Repository or base branch not found                 |
| `5`  | Dirty working tree (use `--reset-hard` to override) |

CI scripts that branch on exit code may need to widen their `case` matchers.

## Output stream separation

1.x emitted everything to stdout. 2.0 splits it:

- **stdout**: machine-readable output only (the `--json` summary; completion scripts; `config get/list` output).
- **stderr**: human-readable progress, warnings, and errors. Safe to discard in scripts (`2>/dev/null`).

If you were capturing stdout for logs, you'll now want to redirect both: `&> log.txt` (bash) or `2>&1 | tee log.txt`.

## Dirty working trees

1.x silently ran `git reset --hard` on every target repo before pulling. 2.0 refuses to touch a dirty repo and exits with code 5. Pass `--reset-hard` to restore the old destructive behavior, or commit/stash first.

## Hardcoded `main` is gone

1.x assumed every repo's base branch was `main`. 2.0 auto-detects via `git symbolic-ref refs/remotes/origin/HEAD` (with a `main` → `master` fallback). Pass `-b/--base <branch>` to override per-run.
