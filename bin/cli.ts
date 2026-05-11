#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { program } from 'commander';
import type { CommanderError } from 'commander';
import chalk from 'chalk';
import * as log from '../lib/log.js';
import { CODES, CliError } from '../lib/exit-codes.js';
import registerUpgrade from '../lib/commands/upgrade.js';
import registerConfig from '../lib/commands/config.js';
import registerCompletion from '../lib/commands/completion.js';

function readPkgVersion(): string {
  const candidates = [
    new URL('../package.json', import.meta.url),
    new URL('../../package.json', import.meta.url),
  ];
  for (const u of candidates) {
    try {
      const parsed = JSON.parse(readFileSync(u, 'utf8')) as { version: string };
      if (typeof parsed.version === 'string') return parsed.version;
    } catch {
      // try next candidate
    }
  }
  throw new Error('Could not locate package.json');
}

program
  .name('batch-upgrade-npm')
  .usage('<command> [options]')
  .description('A CLI tool to upgrade npm packages across multiple repositories')
  .version(readPkgVersion())
  .option('-q, --quiet', 'suppress non-error output')
  .option('-v, --verbose', 'verbose output (includes child process output)')
  .option('--debug', 'debug output (alias for --verbose with extra detail)')
  .option('--no-color', 'disable colorized output (also honors NO_COLOR env)')
  .addHelpText(
    'after',
    `
Examples:
  Update one package across multiple repos:
    $ batch-upgrade-npm upgrade -p react --versions ^18.0.0 -r ./web ./admin

  Multiple packages, one repo, dry-run preview:
    $ batch-upgrade-npm upgrade -p lodash axios --versions ^4.17.21 ^1.4.0 -r ./api --dry-run

  JSON summary in CI:
    $ CI=true batch-upgrade-npm upgrade --json -p react --versions ^18.0.0 -r ./app > result.json

Environment:
  NO_COLOR=1                    Disable colored output
  CI=true                       Auto-confirm (skips prompt)
  BATCH_UPGRADE_PACKAGES        Default for --packages (space-separated)
  BATCH_UPGRADE_VERSIONS        Default for --versions (space-separated)
  BATCH_UPGRADE_REPOS           Default for --repos (space-separated)
  BATCH_UPGRADE_BASE_BRANCH     Default for --base
  BATCH_UPGRADE_YES=true        Default for --yes

Exit codes:
  0  Success
  1  One or more repositories failed
  2  Usage error (invalid flags or arguments)
  3  GitHub CLI authentication failure
  4  Repository or base branch not found
  5  Dirty working tree (use --reset-hard to override)

Run 'batch-upgrade-npm <command> --help' for command-specific options.
`
  )
  .exitOverride((err: CommanderError) => {
    if (err.code === 'commander.helpDisplayed' || err.code === 'commander.version') {
      process.exit(0);
    }
    process.exit(2);
  });

registerUpgrade(program);
registerConfig(program);
registerCompletion(program);

program.parseAsync(process.argv).catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  log.error(chalk.red(`Error: ${message}`));
  if (err instanceof CliError && err.hint) {
    log.error(chalk.red('  → Try: ' + err.hint));
  }
  const code = err instanceof CliError ? err.code : CODES.RUNTIME;
  process.exit(code);
});
