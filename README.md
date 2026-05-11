# Batch Upgrade NPM Packages

A command-line tool to upgrade npm packages across multiple repositories with automated pull request creation.

[![npm version](https://img.shields.io/npm/v/batch-upgrade-npm-packages.svg)](https://www.npmjs.com/package/batch-upgrade-npm-packages)

## Features

- Update npm packages across multiple repositories in one command
- Subcommand-based CLI (`upgrade`, `config`, `completion`) familiar to users of `gh`/`docker`/`kubectl`
- Safe by default: refuses to overwrite uncommitted changes unless you explicitly opt in
- Auto-detects each repo's base branch (`main`, `master`, or whatever `origin/HEAD` points at) — no hardcoding
- `--dry-run` previews every change without touching any repo or remote
- `--json` emits a machine-readable summary for scripting and CI
- Documented exit codes; respects `NO_COLOR`, `CI`, and `BATCH_UPGRADE_*` env vars
- Creates timestamped feature branches and opens PRs via the GitHub CLI; never commits to main
- Skips packages that are already up-to-date (semver-aware)
- Searches `dependencies`, `devDependencies`, and `peerDependencies`
- Per-repo failures don't stop the run; the summary tells you what succeeded
- Shell completion for bash, zsh, and fish

## Requirements

- Node.js 18 or higher
- Git
- [GitHub CLI](https://cli.github.com/) (`gh`), authenticated with `gh auth login`
- npm

## Installation

```bash
npm install -g batch-upgrade-npm-packages
gh auth login   # one-time
```

## Quick start

```bash
# Update one package across three repos
batch-upgrade-npm upgrade -p react --versions ^18.0.0 -r ./web ./admin ./mobile

# Preview only — no commits, no PRs, no fs changes
batch-upgrade-npm upgrade -p react --versions ^18.0.0 -r ./web --dry-run

# JSON summary for CI
CI=true batch-upgrade-npm upgrade --json -p react --versions ^18.0.0 -r ./app > result.json
```

## Commands

### `upgrade`

Update packages across one or more repositories and open PRs.

| Flag                           | Description                                                               |
| ------------------------------ | ------------------------------------------------------------------------- |
| `-p, --packages <packages...>` | Packages to update (space-separated)                                      |
| `--versions <versions...>`     | Version ranges in the same order as `--packages`                          |
| `-r, --repos <repos...>`       | Repository paths                                                          |
| `-b, --base <branch>`          | Base branch override (auto-detected from `origin/HEAD` if omitted)        |
| `-i, --interactive`            | Prompt for any missing input                                              |
| `-y, --yes`                    | Skip the confirmation prompt (also implied by `CI=true` or non-TTY stdin) |
| `--reset-hard`                 | Discard uncommitted changes in target repos before updating (DESTRUCTIVE) |
| `-n, --dry-run`                | Preview without modifying any repository                                  |
| `--json`                       | Emit a machine-readable JSON summary on stdout                            |

### `config`

Inspect effective configuration resolved from environment variables.

```bash
batch-upgrade-npm config list
batch-upgrade-npm config get packages
batch-upgrade-npm config set repos "./a ./b"   # prints the export line; no on-disk config file is written
```

Persistent config files are not yet supported. Use environment variables (below) for defaults.

### `completion`

Print a shell completion script.

```bash
# Bash
eval "$(batch-upgrade-npm completion bash)"

# Zsh
batch-upgrade-npm completion zsh > "${fpath[1]}/_batch-upgrade-npm"

# Fish
batch-upgrade-npm completion fish > ~/.config/fish/completions/batch-upgrade-npm.fish
```

## Global flags

| Flag            | Description                                                      |
| --------------- | ---------------------------------------------------------------- |
| `-V, --version` | Print version                                                    |
| `-h, --help`    | Print help (use `<command> --help` for command-specific options) |
| `-q, --quiet`   | Suppress non-error output                                        |
| `-v, --verbose` | Verbose output (includes child-process output)                   |
| `--debug`       | Debug output (alias for `--verbose` with extra detail)           |
| `--no-color`    | Disable colorized output (also honors `NO_COLOR=1`)              |

`--quiet` is mutually exclusive with `--verbose` and `--debug`.

## Environment variables

| Var                         | Effect                                               |
| --------------------------- | ---------------------------------------------------- |
| `NO_COLOR=1`                | Disable colored output                               |
| `CI=true`                   | Auto-confirm (skips the prompt before any work runs) |
| `BATCH_UPGRADE_PACKAGES`    | Default for `--packages` (space-separated)           |
| `BATCH_UPGRADE_VERSIONS`    | Default for `--versions` (space-separated)           |
| `BATCH_UPGRADE_REPOS`       | Default for `--repos` (space-separated)              |
| `BATCH_UPGRADE_BASE_BRANCH` | Default for `--base`                                 |
| `BATCH_UPGRADE_YES=true`    | Default for `--yes`                                  |

Precedence: command-line flag > environment variable > interactive prompt > error.

## Exit codes

| Code | Meaning                                             |
| ---- | --------------------------------------------------- |
| `0`  | Success                                             |
| `1`  | One or more repositories failed                     |
| `2`  | Usage error (invalid flags or arguments)            |
| `3`  | GitHub CLI authentication failure                   |
| `4`  | Repository or base branch not found                 |
| `5`  | Dirty working tree (use `--reset-hard` to override) |

## How it works

For each repository:

1. **Pre-flight**: Verify the working tree is clean. If dirty without `--reset-hard`, abort with exit 5.
2. **Branch**: Detect the base branch (`origin/HEAD` → fallback `main` → `master`), check it out, pull, and create `update-packages-YYYYMMDDHHmmss`.
3. **Analyze**: For each package, locate it in `dependencies` / `devDependencies` / `peerDependencies` and skip when the current version is already `>= target`.
4. **Update**: Edit `package.json` (skipped in `--dry-run`).
5. **Verify**: `npm install --force` then a clean `npm install` to catch lockfile/peer issues.
6. **Commit & push**: Stage `package.json` + `package-lock.json`, commit, push to `origin`.
7. **PR**: Open a pull request with `gh pr create --base <detected-branch>`.
8. **Cleanup**: If the diff was empty (everything skipped), delete the feature branch.

## Output streams

- **stdout**: machine-readable output only (the JSON summary when `--json` is set; completion scripts; `config get`/`list` output).
- **stderr**: human-readable progress, warnings, and errors. Safe to discard in scripts (`2>/dev/null`).

## Safety

- Refuses to touch repos with uncommitted changes unless you pass `--reset-hard`.
- All changes land on a feature branch; the tool never commits to your base branch.
- Validates `gh auth status` before doing any work; exits 3 with a hint if not authenticated.
- Per-repo failures are isolated — the summary reports which repos succeeded, failed, and were skipped.
- Arguments (package names, version strings, PR titles, PR bodies) are passed to subprocesses as argv arrays, never spliced into shell strings — shell-injection-safe.
- `--dry-run` emits `[dry-run] Would run: …` lines for every mutating operation that would have executed.

## Migrating from 1.x

`v2.0.0` is a breaking release. Most changes are flag layout and exit codes; the core upgrade workflow is unchanged.

| 1.x form                                         | 2.0.0 form                                                           |
| ------------------------------------------------ | -------------------------------------------------------------------- |
| `batch-upgrade-npm -p react -v ^18.0.0 -r ./app` | `batch-upgrade-npm upgrade -p react --versions ^18.0.0 -r ./app`     |
| `batch-upgrade-npm -p react -v ^18.0.0 -r ./app` | (legacy form still works with a deprecation warning until 3.0)       |
| (always-on confirmation)                         | `--yes` / `CI=true` / non-TTY auto-confirms; otherwise still prompts |
| (silently runs `git reset --hard`)               | Aborts with exit 5; pass `--reset-hard` to opt in                    |
| `-v` was `--versions`                            | `-v` is now `--verbose`; use long-only `--versions`                  |
| Hardcoded `main` base branch                     | Auto-detected per-repo; override with `-b/--base`                    |
| Exit codes 0/1 only                              | 0/1/2/3/4/5 — see Exit codes table above                             |
| All output to stdout                             | Progress on stderr; data on stdout                                   |
| No JSON, no env vars, no completion              | `--json`, `BATCH_UPGRADE_*` env vars, `completion <shell>`           |
| Node.js 14+                                      | Node.js 18+                                                          |

The two changes most likely to break existing scripts:

1. **`-v` is no longer `--versions`.** A `sed -i 's/ -v / --versions /g' your-ci-script.sh` will fix scripts.
2. **Confirmation now requires `--yes` (or `CI=true`).** Existing CI runs that piped `y` to stdin should now use `--yes`.

## License

MIT

## Links

- [npm Package](https://www.npmjs.com/package/batch-upgrade-npm-packages)
- [Changelog](./CHANGELOG.md)
