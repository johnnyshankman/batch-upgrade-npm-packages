#!/usr/bin/env node

const { program } = require('commander');
const chalk = require('chalk');
const pkg = require('../package.json');
const log = require('../lib/log');
const { CODES, CliError } = require('../lib/exit-codes');

const KNOWN_SUBCOMMANDS = new Set(['upgrade', 'config', 'completion', 'help']);

function applyLegacyShim() {
  const argv2 = process.argv[2];
  if (!argv2) return;
  if (KNOWN_SUBCOMMANDS.has(argv2)) return;
  if (['-h', '--help', '-V', '--version'].includes(argv2)) return;
  if (argv2.startsWith('-')) {
    process.stderr.write(
      chalk.yellow(
        'Deprecation: invoke as `batch-upgrade-npm upgrade …`. Legacy flag-only form will be removed in 3.0.\n'
      )
    );
    process.argv.splice(2, 0, 'upgrade');
  }
}

applyLegacyShim();

program
  .name('batch-upgrade-npm')
  .description('A CLI tool to upgrade npm packages across multiple repositories')
  .version(pkg.version)
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
  .exitOverride((err) => {
    if (err.code === 'commander.helpDisplayed' || err.code === 'commander.version') {
      process.exit(0);
    }
    process.exit(2);
  });

require('../lib/commands/upgrade')(program);
require('../lib/commands/config')(program);
require('../lib/commands/completion')(program);

program.parseAsync(process.argv).catch((error) => {
  log.error(chalk.red(`Error: ${error.message}`));
  if (error instanceof CliError && error.hint) {
    log.error(chalk.red('  → Try: ' + error.hint));
  }
  process.exit(typeof error.code === 'number' ? error.code : CODES.RUNTIME);
});
