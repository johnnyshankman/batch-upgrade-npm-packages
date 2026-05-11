# CLAUDE.md

Project-specific guidance for Claude Code sessions in this repo.

## Project

`batch-upgrade-npm-packages` — Node.js CLI that upgrades npm packages across multiple repos, commits to a feature branch, and opens GitHub PRs via `gh`. Published to npm as `batch-upgrade-npm-packages`; installed binary is `batch-upgrade-npm`.

Current version: 3.0.0 (see `CHANGELOG.md` for the 3.0 breaking changes — ESM-only library API, legacy CLI shim removed, source migrated to TypeScript).

## Stack

- Runtime: Node.js >=18
- Module format: ESM (`"type": "module"`). Source is TypeScript; published artifact is plain ESM JS in `dist/`.
- Source language: TypeScript 5 (strict, `NodeNext`, `verbatimModuleSyntax`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`)
- CLI framework: `commander` v12
- Subprocess: `execa` v9 (argv-array calls only — never shell strings)
- Prompts: `inquirer` v12
- Spinner: `ora` v9; colors: `chalk` v5
- Semver: `semver` v7
- Tests: `vitest` v2 with two workspace projects (`unit`, `integration`); coverage via `@vitest/coverage-v8`
- Lint/format: ESLint 9 (flat config, `eslint.config.js`) + `typescript-eslint` v8 + Prettier 3
- Build: `tsc` → `dist/`, post-build script restores shebang + `chmod +x dist/bin/cli.js`
- CI: GitHub Actions, matrix Node 18/20/22

## Layout

```
bin/cli.ts                  Commander entry; registers subcommands
lib/index.ts                updatePackages() + updateRepo() core workflow; exports public types
lib/runCmd.ts               execa wrapper with dry-run + mutating flag
lib/log.ts                  centralized logger (quiet/verbose/debug/json/dryRun/color)
lib/exit-codes.ts           CODES map + CliError class + ExitCode type
lib/detectBaseBranch.ts     origin/HEAD → main → master fallback
lib/commands/upgrade.ts     `upgrade` subcommand: flags, env defaults, prompts
lib/commands/config.ts      `config get/set/list` (env-var inspection only)
lib/commands/completion.ts  `completion <bash|zsh|fish>` script generators
scripts/post-build.mjs      Post-tsc step: shebang + chmod on dist/bin/cli.js
__tests__/                  unit tests at top level, integration/ spawns real CLI via tsx
tsconfig.json               Source compile config (emits dist/)
tsconfig.test.json          Test-side typecheck only (extends, noEmit)
vitest.config.ts            Global vitest options + coverage config
vitest.workspace.ts         Two-project workspace (unit, integration)
eslint.config.js            ESLint 9 flat config
batch-upgrade-npm-pkgs.sh   legacy bash predecessor (kept for reference)
```

## Conventions

- **NodeNext imports.** All relative imports use the `.js` extension (even when importing a `.ts` file — TypeScript ESM convention). Built-ins use the `node:` prefix (`node:fs`, `node:path`, etc.).
- **No shell strings.** Every subprocess goes through `runCmd(file, argv[], opts)` which calls `execa` with arrays. Never use `shell: true`. Never splice user input into a command string. This was a v2 security fix; do not regress it.
- **Mutating calls must pass `{ mutating: true }`** to `runCmd` so `--dry-run` can intercept them (prints `[dry-run] Would run: …` and returns success without executing).
- **Absolute paths only** when calling `fs` or passing `cwd`. Never `process.chdir()`.
- **Output streams:** progress/warnings/errors → stderr (via `log.info/warn/error/success/debug`). stdout is reserved for machine-readable output (`--json` summary, completion scripts, `config get/list`). Do not `console.log` to stdout from `lib/`.
- **Errors that should set a specific exit code** must throw `CliError(message, CODES.X, hint)`. The CLI entry catches it and exits with `error.code`; the `hint` is rendered as `→ Try: <hint>`.
- **Per-repo failures are isolated** — `updatePackages` collects results and never throws from a single bad repo (except `CODES.DIRTY`, which is fail-fast). Exit code 1 if any repo failed.
- **Style:** Prettier (single quotes, semis, trailing commas es5, 100 cols, 2 spaces). ESLint flat config with `typescript-eslint` recommended + `prefer-const` + `no-var`. Run `npm run lint` and `npm run format:check` before committing — CI enforces both.

## Tests

- `npm test` — both projects (vitest)
- `npm run test:unit` — fast, no subprocess spawning. Vitest project `unit`.
- `npm run test:integration` — Vitest project `integration` (`pool: 'forks'`, `singleFork: true`). Spawns the real `bin/cli.ts` via `node --import tsx/esm` so tests run against TypeScript source without a build step. Helpers in `__tests__/integration/helpers/`: `gitFixture.ts` (temp git repos), `mockGh.ts` (PATH-shimmed fake `gh`), `runCli.ts` (subprocess invocation).
- `npm run test:coverage` — Vitest with `@vitest/coverage-v8`. V8 native coverage that propagates `NODE_V8_COVERAGE` to the spawned `tsx`-loaded subprocess. Source maps map hits back to `.ts` source; `bin/cli.ts` and `lib/commands/*.ts` show real numbers. Writes `coverage/` (gitignored).
- `npm run typecheck` — runs `tsc --noEmit` on both `tsconfig.json` (source) and `tsconfig.test.json` (tests). Fast; catches type drift before tests run.
- `npm run build` — `tsc` + `scripts/post-build.mjs`. Emits `dist/bin/cli.js` (with shebang, mode 0755) and `dist/lib/**/*.{js,d.ts}`. CI runs this on every Node version; `prepublishOnly` runs it before `npm publish`.

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
- Touching `updatePackages` return shape (or any of `UpdatePackagesResult` / `RepositoryResult` / `PackageUpdate` / `UpdateSection`)? It's a public contract documented in CHANGELOG 3.0 and consumed by `--json` plus TS library consumers. Bump major if you change it.
- Adding a flag? Mirror it in `lib/commands/completion.ts` shell-completion lists.
- New runtime dependency? Confirm it's ESM-compatible (the project is `"type": "module"`). CJS-only deps will need a dynamic `import()` or won't load at all.
- Touching the published artifact shape (`dist/`)? Make sure `bin/cli.ts` and `lib/index.ts` both compile cleanly; the dual-candidate `package.json` lookup in `readPkgVersion()` must keep working from both `tsx`-running-source and `node`-running-compiled.

## Context Prime — session bootstrap

Read on session start: `README.md`, `CHANGELOG.md`, this file, `package.json`, then any `lib/` file relevant to the task. The codebase is small (~10 TypeScript source files) — full reads are cheap. There is no separate `/docs` directory; design context lives in the CHANGELOG entries (especially 2.0 and 3.0) and inline in the files above.
