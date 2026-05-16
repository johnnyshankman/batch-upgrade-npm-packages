# Batch Upgrade NPM Packages

A command-line tool to upgrade npm packages across multiple repositories with automated pull request creation.

[![npm version](https://img.shields.io/npm/v/batch-upgrade-npm-packages.svg)](https://www.npmjs.com/package/batch-upgrade-npm-packages)
[![build](https://github.com/johnnyshankman/batch-upgrade-npm-packages/actions/workflows/build.yml/badge.svg?branch=main)](https://github.com/johnnyshankman/batch-upgrade-npm-packages/actions/workflows/build.yml)

## Features

- Update npm packages across multiple repositories in one command
- Creates timestamped feature branches and opens PRs via the GitHub CLI for each repo; never commits to main
- Skips packages that are already up-to-date (semver-aware)
- Searches `dependencies`, `devDependencies`, and `peerDependencies`
- Per-repo failures don't stop the run; the summary tells you what succeeded
- Safe by default: refuses to overwrite uncommitted changes unless you explicitly opt in
- Auto-detects each repo's base branch (`main`, `master`, or whatever `origin/HEAD` points at) — no hardcoding
- `--dry-run` previews every change without touching any repo or remote
- `--json` emits a machine-readable summary for scripting and CI
- Subcommand-based CLI (`upgrade`, `config`, `completion`) familiar to users of `gh`/`docker`/`kubectl`
- Documented exit codes; respects `NO_COLOR`, `CI`, and `BATCH_UPGRADE_*` env vars
- Shell completion for bash, zsh, and fish

## Requirements

- Node.js 22 or higher
- Git
- [GitHub CLI](https://cli.github.com/) (`gh`), authenticated with `gh auth login`
- npm

The package ships as ESM with bundled TypeScript declarations — no extra
`@types/*` install is needed if you're using the library API from
TypeScript.

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
batch-upgrade-npm config set repos "./a ./b"
```

> **Note:** `config set` is informational only. It does **not** write a config file or persist anything. It prints the equivalent `export …` line for you to copy into your shell profile. Persistent config files are not yet supported — use the environment variables documented below.

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

## JSON output

When `--json` is passed to `upgrade`, exactly one JSON object is written to stdout after the run completes. Progress, warnings, and errors continue to go to stderr.

```json
{
  "summary": {
    "total": 2,
    "succeeded": 1,
    "failed": 0,
    "skipped": 1
  },
  "repositories": [
    {
      "repo": "./web",
      "status": "success",
      "branch": "update-packages-20260511153400",
      "baseBranch": "main",
      "prUrl": "https://github.com/acme/web/pull/42",
      "updates": [
        {
          "package": "react",
          "fromVersion": "^17.0.2",
          "toVersion": "^18.0.0",
          "section": "dependencies"
        }
      ],
      "error": null,
      "errorCode": null,
      "dryRun": false
    },
    {
      "repo": "./admin",
      "status": "skipped",
      "branch": "update-packages-20260511153400",
      "baseBranch": "main",
      "prUrl": null,
      "updates": [],
      "error": null,
      "errorCode": null,
      "dryRun": false
    }
  ],
  "dryRun": false
}
```

### Top-level fields

| Field          | Type    | Description                                                 |
| -------------- | ------- | ----------------------------------------------------------- |
| `summary`      | object  | Aggregated counts across all repositories                   |
| `repositories` | array   | One entry per repository in the same order as `--repos`     |
| `dryRun`       | boolean | Whether the run was a `--dry-run` preview (no side effects) |

### `summary` fields

| Field       | Type   | Description                             |
| ----------- | ------ | --------------------------------------- |
| `total`     | number | Total number of repositories processed  |
| `succeeded` | number | Repositories whose PR was created       |
| `failed`    | number | Repositories that errored               |
| `skipped`   | number | Repositories with no applicable updates |

### `repositories[]` fields

| Field        | Type           | Description                                                                                          |
| ------------ | -------------- | ---------------------------------------------------------------------------------------------------- |
| `repo`       | string         | Repository path as passed to `--repos`                                                               |
| `status`     | string         | One of `"success"`, `"failed"`, `"skipped"`                                                          |
| `branch`     | string \| null | Feature branch name (`update-packages-YYYYMMDDHHmmss`); `null` if the run failed before branching    |
| `baseBranch` | string \| null | Detected (or `--base`-overridden) base branch; `null` if detection itself failed                     |
| `prUrl`      | string \| null | URL of the created pull request; `null` if no PR was created                                         |
| `updates`    | array          | Per-package updates that were applied; empty when no packages matched or all were already up-to-date |
| `error`      | string \| null | Human-readable error message when `status === "failed"`                                              |
| `errorCode`  | string \| null | Stable token identifying the failure mode (see below); `null` on success/skip                        |
| `dryRun`     | boolean        | Whether this repo was processed in `--dry-run` mode                                                  |

### `updates[]` fields

| Field         | Type   | Description                                                        |
| ------------- | ------ | ------------------------------------------------------------------ |
| `package`     | string | npm package name                                                   |
| `fromVersion` | string | Version range that was in `package.json` before the update         |
| `toVersion`   | string | Version range now in `package.json`                                |
| `section`     | string | One of `"dependencies"`, `"devDependencies"`, `"peerDependencies"` |

### `errorCode` values

`GIT_CHECKOUT_FAILED`, `GIT_PULL_FAILED`, `GIT_BRANCH_FAILED`, `GIT_PUSH_FAILED`, `NPM_INSTALL_FORCE_FAILED`, `NPM_INSTALL_FAILED`, `GH_PR_CREATE_FAILED`, `CLI_ERROR_<n>` (where `<n>` is the exit code), or `UNKNOWN`.

The process exit code is `0` when `summary.failed === 0` and `1` otherwise. See [Exit codes](#exit-codes) above for usage/auth/not-found/dirty failures that exit before per-repo results are produced.

## Programmatic API

In addition to the CLI, the package exports an ESM module you can drive from
your own Node.js scripts. The library returns the same result shape that
`--json` prints to stdout.

```js
import { updatePackages } from 'batch-upgrade-npm-packages';

const result = await updatePackages({
  packages: ['react'],
  versions: ['^18.0.0'],
  repos: ['./web', './admin'],
  resetHard: false,
  baseBranch: null, // null = auto-detect from origin/HEAD
});

console.log(result.summary); // { total, succeeded, failed, skipped }
```

With TypeScript, the result and options are fully typed:

```ts
import { updatePackages } from 'batch-upgrade-npm-packages';
import type {
  UpdatePackagesOptions,
  UpdatePackagesResult,
  RepositoryResult,
} from 'batch-upgrade-npm-packages';
```

The library still requires `gh` to be authenticated and the target repos to
have clean working trees (or `resetHard: true`). Per-repo failures populate
`repositories[i].error` / `errorCode` rather than throwing, matching the CLI
contract. Top-level usage errors (no packages specified, gh not
authenticated, dirty tree without `resetHard`) throw a `CliError` whose
`.code` matches the CLI exit-code table.

## Safety

- Refuses to touch repos with uncommitted changes unless you pass `--reset-hard`.
- All changes land on a feature branch; the tool never commits to your base branch.
- Validates `gh auth status` before doing any work; exits 3 with a hint if not authenticated.
- Per-repo failures are isolated — the summary reports which repos succeeded, failed, and were skipped.
- Arguments (package names, version strings, PR titles, PR bodies) are passed to subprocesses as argv arrays, never spliced into shell strings — shell-injection-safe.
- `--dry-run` emits `[dry-run] Would run: …` lines for every mutating operation that would have executed.

## Upgrading from 1.x?

See [MIGRATING.md](./MIGRATING.md) for the full 1.x → 2.0 migration guide, including the two changes most likely to break existing scripts (`-v` is no longer `--versions`, and confirmation now requires `--yes` / `CI=true` / non-TTY stdin).

## Releasing

Releases are manual, single-button. The maintainer:

1. Opens a PR bumping `version` in `package.json` and adding a new `## [X.Y.Z]` entry in `CHANGELOG.md`. Merge to `main`.
2. Opens **Actions → release → Run workflow** on `main`. Optionally checks `dry_run` to exercise the preflight without publishing.
3. Approves the `npm-release` environment gate.

The workflow publishes to npm with provenance via OIDC, then creates the `vX.Y.Z` git tag and matching GitHub release. It refuses to run if the version already exists on npm or as a release — re-running after a successful release fails fast in preflight.

Credentials: **npm Trusted Publishing (OIDC)**. No `NPM_TOKEN` is stored in the repo.

## License

MIT

## Links

- [npm Package](https://www.npmjs.com/package/batch-upgrade-npm-packages)
- [Changelog](./CHANGELOG.md)
