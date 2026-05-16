# Changelog

All notable changes to this project are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [4.0.0]

### Breaking changes

- **Minimum Node.js raised to 22.** Node.js 18 (end-of-life 2025-04-30) and
  Node.js 20 (end-of-life 2026-04-30) are no longer supported. `engines.node`
  is now `>=22.0.0`. Installing on Node 18 or 20 produces an `EBADENGINE`
  warning; running the CLI or importing the library on those versions is
  unsupported. The supported set is the active Node.js LTS lines — 22 and 24.

### Changed

- **`ora` 8 → 9.** ora 9 raised its own minimum to Node 20, which no longer
  conflicts with this package's (now 22) floor — so the `^8` pin documented
  in the 3.0 entry is lifted. ora's spinner API is unchanged; there is no
  runtime-behavior change.
- **`@types/node` 20 → 22**, tracking the new minimum so typechecks flag any
  use of APIs unavailable on the lowest supported runtime.
- **CI runs on Node 22 and 24** (was 18, 20, 22) in `build.yml` and `ci.yml`.
  The `release.yml` publish pipeline now runs on Node 24 (was 20).

### Unchanged contracts

- All exit codes (`0`/`1`/`2`/`3`/`4`/`5`) — unchanged.
- `--json` output schema — unchanged.
- Every flag name and short alias — unchanged.
- `--help` output — unchanged.
- The `updatePackages` library API and all exported types — unchanged.

## [3.0.0]

### Breaking changes

- **ESM-only.** `batch-upgrade-npm-packages` is now published as an ES module
  (`"type": "module"`). The library API (`updatePackages` and its companion
  types/utilities) must be consumed via `import`, e.g.:

  ```js
  import { updatePackages } from 'batch-upgrade-npm-packages';
  ```

  `require('batch-upgrade-npm-packages')` no longer works. The CLI binary
  (`batch-upgrade-npm`) is unaffected — it spawns its own process and presents
  no API surface to callers.

- **The legacy flag-only CLI form is removed.** The 2.0 deprecation shim that
  let you invoke `batch-upgrade-npm -p <pkg> --versions <ver> -r <repo>` (with
  no `upgrade` subcommand) is gone. Use `batch-upgrade-npm upgrade <flags>`.
  Bare flag invocations now exit `2` with `error: unknown option '-p'`.
- **Source is TypeScript with strict types.** The shipped artifact is plain
  ESM JavaScript compiled to `dist/`; consumers don't need TypeScript to use
  it, but they get full `.d.ts` definitions for free.

### Added

- **TypeScript type definitions** ship with the package. The following types
  are exported from the package entry point:
  - `UpdatePackagesOptions`, `UpdatePackagesResult`, `UpdateSummary`
  - `RepositoryResult`, `PackageUpdate`, `UpdateSection`
  - `CliError`, `ExitCode`, `CODES`

### Changed

- **Test runner:** Jest → Vitest. The CLI test surface and the `--help`
  snapshot are unchanged byte-for-byte.
- **Lint stack:** ESLint 9 flat config (`eslint.config.js`) +
  `typescript-eslint` 8. The legacy `.eslintrc.json` / `.eslintignore` are
  removed.
- **Build tooling:** TypeScript 5 + `tsc` for the publishable build; `tsx`
  for running tests directly against `.ts` source (no pre-build step
  required to run `npm test`).
- **Dependency bumps (ESM-only majors):** `chalk` 4 → 5, `execa` 5 → 9,
  `inquirer` 8 → 12, `ora` 5 → 8, `commander` 9 → 12. Runtime behavior is
  preserved; these moves were forced by the ESM-only conversion. (`ora` is
  pinned to `^8` rather than `^9` because ora 9 raises its minimum to
  Node 20.)
- **Coverage:** `c8` → `@vitest/coverage-v8`. Same V8 native coverage
  underneath, with source maps that attribute lines back to the `.ts`
  source — including the bin spawned by integration tests.

### Unchanged contracts

- All exit codes (`0`/`1`/`2`/`3`/`4`/`5`) — unchanged.
- `--json` output schema — unchanged.
- Every flag name and short alias — unchanged.
- `--help` output — byte-identical to 2.0.
- Node.js 18+ minimum — unchanged.

## [2.0.0]

### Breaking changes

- **`-v` is no longer an alias for `--versions`.** Use the long-form
  `--versions` instead. `-v` is now `--verbose` (and `-V` is `--version`,
  matching the universal convention).
- **`batch-upgrade-npm` is now a subcommand-style CLI.** The primary form is
  `batch-upgrade-npm upgrade <flags>`. The old flag-only form still works
  for now via a deprecation shim that prints a warning on stderr; the shim
  will be removed in 3.0.
- **`git reset --hard` is no longer silently performed on target repos.**
  Repos with uncommitted changes cause an exit-5 abort with an actionable
  message. Pass `--reset-hard` to restore the previous behavior.
- **Confirmation prompts are now skippable.** `--yes`, `CI=true`, and
  non-TTY stdin all auto-confirm. Non-TTY runs without an auto-confirm
  source fail fast with exit 2.
- **Exit codes are expanded** beyond 0/1:
  - `0` success
  - `1` runtime failure (one or more repos failed)
  - `2` usage error
  - `3` GitHub CLI authentication failure
  - `4` repository or base branch not found
  - `5` dirty working tree
- **Output streams are now strictly separated.** Progress, warnings, and
  errors go to **stderr**. **stdout** is reserved for machine-readable
  output (the `--json` summary, completion scripts, `config get/list`).
- **Node.js 18+ required** (was 14+).

### Added

- `upgrade`, `config`, and `completion` subcommands.
- `--dry-run` previews every git/npm/gh operation without modifying any
  repository on disk or remote. Emits `[dry-run] Would run: …` lines.
- `--json` emits a structured summary to stdout: `{ summary, repositories,
dryRun }` where `repositories[]` carries `status`, `branch`, `baseBranch`,
  `prUrl`, `updates: [{package, fromVersion, toVersion, section}]`,
  `error`, and `errorCode` per repo.
- `-b, --base <branch>` overrides the auto-detected base branch.
- Base branch is auto-detected per repo via
  `git symbolic-ref refs/remotes/origin/HEAD`, with a `main` → `master`
  fallback. `--base` flag overrides it.
- `-q, --quiet`, `-v, --verbose`, `--debug`, and `--no-color` flags.
- Honors `NO_COLOR` per [no-color.org](https://no-color.org).
- `BATCH_UPGRADE_PACKAGES`, `BATCH_UPGRADE_VERSIONS`, `BATCH_UPGRADE_REPOS`,
  `BATCH_UPGRADE_BASE_BRANCH`, and `BATCH_UPGRADE_YES` env vars supply
  defaults.
- `--help` now includes Examples, Environment, and Exit codes sections.
- `completion <bash|zsh|fish>` emits a shell completion script.
- Actionable error messages: each per-repo failure now prints a
  `→ Try: <command>` hint pointing at the likely fix.
- Captures the `gh pr create` URL and surfaces it as `repositories[].prUrl`
  in JSON output.

### Fixed

- **Shell-injection vulnerability** in the commit message and PR title/body
  paths. Package names with shell metacharacters (`"`, `` ` ``, `$(...)`,
  `;`) could execute arbitrary code via the old `executeCommand`
  helper, which split command strings on whitespace and re-spawned them
  with `shell: true`. Every external command now passes its arguments as
  an `argv` array through `execa`, eliminating the shell layer entirely.
- `--version` now reads from `package.json` instead of a hardcoded
  `'1.0.0'` (the source of the previous 1.0.0/1.1.0 mismatch).
- `process.chdir()` is no longer used. Each subprocess receives an explicit
  `cwd` and each `fs` call uses an absolute path, removing a global-state
  hazard.
- `git diff --quiet || echo "changes"` shell pipeline replaced with a
  direct exit-code check on `git diff --quiet`. The previous form could
  silently report "no changes" if the diff output didn't contain the
  literal substring "changes".

### Internal

- New helpers: `lib/runCmd.js` (safe execa wrapper with dry-run support),
  `lib/log.js` (centralized logger honoring quiet/verbose/debug/no-color/
  json/dry-run modes), `lib/exit-codes.js` (`CODES` map + `CliError`),
  `lib/detectBaseBranch.js`.
- Subcommand modules: `lib/commands/{upgrade,config,completion}.js`.
- Jest configured with two projects (`unit`, `integration`). The
  integration suite spawns the real CLI binary as a subprocess and
  asserts against real git fixtures and a `PATH`-shimmed mock `gh`.
- ESLint + Prettier configured.
- GitHub Actions CI matrix on Node 18, 20, 22. Coverage report uploaded
  as an artifact from the Node 20 job.

## [1.1.0] — Pre-2.0 baseline

The starting point for the 2.0.0 refactor. See git history for details.

[4.0.0]: https://github.com/johnnyshankman/batch-upgrade-npm-packages/compare/v3.0.0...v4.0.0
[3.0.0]: https://github.com/johnnyshankman/batch-upgrade-npm-packages/compare/v2.0.0...v3.0.0
[2.0.0]: https://github.com/johnnyshankman/batch-upgrade-npm-packages/compare/v1.1.0...v2.0.0
[1.1.0]: https://github.com/johnnyshankman/batch-upgrade-npm-packages/releases/tag/v1.1.0
