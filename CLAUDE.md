# CLAUDE.md

Project-specific guidance for Claude Code sessions in this repo.

## Project

`batch-upgrade-npm-packages` — Node.js CLI that upgrades npm packages across multiple repos, commits to a feature branch, and opens GitHub PRs via `gh`. Published to npm as `batch-upgrade-npm-packages`; installed binary is `batch-upgrade-npm`.

Current version: 2.0.0 (see `CHANGELOG.md` for the 2.0 breaking changes — flag layout, exit codes, output streams, Node 18+).

## Stack

- Runtime: Node.js >=18
- CLI framework: `commander` v9
- Subprocess: `execa` v5 (argv-array calls only — never shell strings)
- Prompts: `inquirer` v8
- Spinner: `ora` v5; colors: `chalk` v4
- Semver: `semver` v7
- Tests: `jest` v30 with two projects (`unit`, `integration`)
- Lint/format: ESLint 8 + Prettier 3
- CI: GitHub Actions, matrix Node 18/20/22

## Layout

```
bin/cli.js                  Commander entry; registers subcommands; legacy flag-only shim
lib/index.js                updatePackages() + updateRepo() core workflow
lib/runCmd.js               execa wrapper with dry-run + mutating flag
lib/log.js                  centralized logger (quiet/verbose/debug/json/dryRun/color)
lib/exit-codes.js           CODES map + CliError class
lib/detectBaseBranch.js     origin/HEAD → main → master fallback
lib/commands/upgrade.js     `upgrade` subcommand: flags, env defaults, prompts
lib/commands/config.js      `config get/set/list` (env-var inspection only)
lib/commands/completion.js  `completion <bash|zsh|fish>` script generators
__tests__/                  unit tests at top level, integration/ spawns real CLI
batch-upgrade-npm-pkgs.sh   legacy bash predecessor (kept for reference)
```

## Conventions

- **No shell strings.** Every subprocess goes through `runCmd(file, argv[], opts)` which calls `execa` with arrays. Never use `shell: true`. Never splice user input into a command string. This was a v2 security fix; do not regress it.
- **Mutating calls must pass `{ mutating: true }`** to `runCmd` so `--dry-run` can intercept them (prints `[dry-run] Would run: …` and returns success without executing).
- **Absolute paths only** when calling `fs` or passing `cwd`. Never `process.chdir()`.
- **Output streams:** progress/warnings/errors → stderr (via `log.info/warn/error/success/debug`). stdout is reserved for machine-readable output (`--json` summary, completion scripts, `config get/list`). Do not `console.log` to stdout from `lib/`.
- **Errors that should set a specific exit code** must throw `CliError(message, CODES.X, hint)`. The CLI entry catches it and exits with `error.code`; the `hint` is rendered as `→ Try: <hint>`.
- **Per-repo failures are isolated** — `updatePackages` collects results and never throws from a single bad repo (except `CODES.DIRTY`, which is fail-fast). Exit code 1 if any repo failed.
- **Style:** Prettier (single quotes, semis, trailing commas es5, 100 cols, 2 spaces). ESLint `eslint:recommended` + `prefer-const` + `no-var`. Run `npm run lint` and `npm run format:check` before committing — CI enforces both.

## Tests

- `npm test` — both projects
- `npm run test:unit` — fast, no subprocess spawning
- `npm run test:integration` — `maxWorkers: 1`, spawns the real `bin/cli.js`. Uses `__tests__/integration/helpers/`: `gitFixture.js` (temp git repos), `mockGh.js` (PATH-shimmed fake `gh`), `runCli.js` (subprocess invocation).
- `npm run test:coverage` — runs `c8 jest`. Uses V8 native coverage (not Istanbul) so spawned subprocesses from the integration suite are instrumented too; `bin/cli.js` and `lib/commands/*` show real numbers. Config is `.c8rc.json`. Writes `coverage/` (gitignored), uploaded in CI from the Node 20 matrix job.

Integration tests must continue to spawn the real binary against real git fixtures. Do not mock `runCmd` or replace integration tests with unit-level fakes. If you add a new helper that spawns child processes, propagate `process.env` (or at minimum `NODE_V8_COVERAGE`) so coverage stays accurate.

## Env vars that change behavior

| Var                                                                                                                         | Effect                                    |
| --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `BATCH_UPGRADE_PACKAGES`, `BATCH_UPGRADE_VERSIONS`, `BATCH_UPGRADE_REPOS`, `BATCH_UPGRADE_BASE_BRANCH`, `BATCH_UPGRADE_YES` | Defaults for the matching `upgrade` flags |
| `CI=true`                                                                                                                   | Auto-confirms the upgrade prompt          |
| `NO_COLOR`                                                                                                                  | Disables chalk colors (per no-color.org)  |

Precedence: CLI flag > env var > interactive prompt > error.

## Exit codes (do not renumber)

`0` success · `1` runtime/repo failure · `2` usage · `3` gh auth · `4` not found · `5` dirty tree.

## When making changes

- Touching subprocess invocations? Keep arrays-only and route through `runCmd`. Confirm `--dry-run` still prevents execution.
- Touching output? Confirm stdout stays machine-readable. The `--json` path must emit exactly one JSON object on stdout and nothing else.
- Touching `updatePackages` return shape? It's a public contract documented in CHANGELOG 2.0 and consumed by `--json`. Bump major if you change it.
- Adding a flag? Mirror it in `lib/commands/completion.js` shell-completion lists.
- Bumping deps? `inquirer` >=9, `chalk` >=5, and `execa` >=6 are ESM-only and will break the CommonJS `require()` calls throughout `lib/`. Stay on the v4/v5/v8 lines unless you're prepared to convert the codebase to ESM.

## Context Prime — session bootstrap

Read on session start: `README.md`, `CHANGELOG.md`, this file, `package.json`, then any `lib/` file relevant to the task. The codebase is small (~10 source files) — full reads are cheap. There is no separate `/docs` directory; design context lives in the CHANGELOG's 2.0 entry and inline in the files above.
