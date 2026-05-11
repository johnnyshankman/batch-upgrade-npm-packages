import type { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { updatePackages } from '../index.js';
import * as log from '../log.js';
import { CODES, CliError } from '../exit-codes.js';

interface UpgradeOptions {
  packages?: string[];
  versions?: string[];
  repos?: string[];
  base?: string;
  interactive?: boolean;
  yes?: boolean;
  resetHard?: boolean;
  dryRun?: boolean;
  json?: boolean;
}

interface GlobalOptions {
  quiet?: boolean;
  verbose?: boolean;
  debug?: boolean;
  color?: boolean;
}

function envList(name: string): string[] | undefined {
  const raw = process.env[name];
  if (!raw) return undefined;
  return raw.split(/\s+/).filter(Boolean);
}

const envDefaults = {
  packages: envList('BATCH_UPGRADE_PACKAGES'),
  versions: envList('BATCH_UPGRADE_VERSIONS'),
  repos: envList('BATCH_UPGRADE_REPOS'),
  baseBranch: process.env['BATCH_UPGRADE_BASE_BRANCH'] || undefined,
  yes: process.env['BATCH_UPGRADE_YES'] === 'true' ? true : undefined,
};

function shouldAutoConfirm(options: UpgradeOptions): { auto: boolean; reason?: string } {
  if (options.yes) return { auto: true, reason: '--yes' };
  if (process.env['CI'] === 'true') return { auto: true, reason: 'CI=true' };
  if (!process.stdin.isTTY) return { auto: true, reason: 'non-TTY stdin' };
  return { auto: false };
}

export default function registerUpgrade(program: Command): void {
  const cmd = program
    .command('upgrade')
    .description('Update packages across one or more repositories and open PRs')
    .option(
      '-p, --packages <packages...>',
      'packages to update (space separated)',
      envDefaults.packages
    )
    .option(
      '--versions <versions...>',
      'version ranges (space separated, matching packages order)',
      envDefaults.versions
    )
    .option(
      '-r, --repos <repos...>',
      'repository paths (space separated, relative to current directory)',
      envDefaults.repos
    )
    .option(
      '-b, --base <branch>',
      'base branch to update against (auto-detected from origin/HEAD if omitted)',
      envDefaults.baseBranch
    )
    .option('-i, --interactive', 'run in interactive mode (will prompt for input)')
    .option(
      '-y, --yes',
      'skip confirmation prompt (also implied by CI=true or non-TTY stdin)',
      envDefaults.yes
    )
    .option(
      '--reset-hard',
      'discard uncommitted changes in target repos before updating (DESTRUCTIVE)'
    )
    .option('-n, --dry-run', 'preview changes without modifying any repository')
    .option('--json', 'emit machine-readable JSON summary to stdout');

  cmd.action(async (options: UpgradeOptions) => {
    const globalOpts = program.opts<GlobalOptions>();
    if (globalOpts.quiet && (globalOpts.verbose || globalOpts.debug)) {
      process.stderr.write(
        chalk.red('Error: --quiet is mutually exclusive with --verbose and --debug.\n')
      );
      process.exit(CODES.USAGE);
    }

    log.configure({
      quiet: globalOpts.quiet === true,
      verbose: globalOpts.verbose === true,
      debug: globalOpts.debug === true,
      color: globalOpts.color === false ? false : undefined,
      dryRun: options.dryRun === true,
      json: options.json === true,
    });

    let packages = options.packages ?? [];
    let versions = options.versions ?? [];
    let repos = options.repos ?? [];

    const hasAllRequiredArgs = packages.length && versions.length && repos.length;
    const interactive = options.interactive || !hasAllRequiredArgs;

    if (interactive) {
      if (!process.stdin.isTTY) {
        log.error(
          chalk.red(
            'Error: Missing required arguments and stdin is not a TTY (non-interactive environment).'
          )
        );
        log.error(
          chalk.red(
            '  → Try: pass --packages, --versions, and --repos explicitly, or set them via env (BATCH_UPGRADE_*)'
          )
        );
        process.exit(CODES.USAGE);
      }

      log.info(chalk.cyan('Batch NPM Package Upgrader'));
      log.info(chalk.cyan('========================='));

      const answers = (await inquirer.prompt([
        {
          type: 'input',
          name: 'packages',
          message: 'Enter packages to update (space-separated):',
          when: !packages.length,
          filter: (input: string): string[] => input.split(' ').filter(Boolean),
        },
        {
          type: 'input',
          name: 'versions',
          message: 'Enter version ranges (space-separated, matching the order of packages):',
          when: !versions.length,
          filter: (input: string): string[] => input.split(' ').filter(Boolean),
          validate: (input: string[], partial: { packages?: string[] }): true | string => {
            const pkgs = packages.length ? packages : (partial.packages ?? []);
            return input.length === pkgs.length
              ? true
              : `Number of versions (${input.length}) must match number of packages (${pkgs.length})`;
          },
        },
        {
          type: 'input',
          name: 'repos',
          message: 'Enter repository paths (space-separated):',
          when: !repos.length,
          filter: (input: string): string[] => input.split(' ').filter(Boolean),
        },
      ])) as { packages?: string[]; versions?: string[]; repos?: string[] };

      packages = packages.length ? packages : (answers.packages ?? []);
      versions = versions.length ? versions : (answers.versions ?? []);
      repos = repos.length ? repos : (answers.repos ?? []);
    }

    if (packages.length !== versions.length) {
      log.error(chalk.red('Error: Number of packages and versions must match.'));
      log.error(
        chalk.red('  → Try: pass one --versions entry per --packages entry, in the same order')
      );
      process.exit(CODES.USAGE);
    }
    if (packages.length === 0) {
      log.error(chalk.red('Error: No packages specified.'));
      log.error(chalk.red('  → Try: pass --packages <name> [<name>...]'));
      process.exit(CODES.USAGE);
    }
    if (repos.length === 0) {
      log.error(chalk.red('Error: No repositories specified.'));
      log.error(chalk.red('  → Try: pass --repos <path> [<path>...]'));
      process.exit(CODES.USAGE);
    }

    log.info(chalk.cyan('\nUpgrading packages:'));
    for (let i = 0; i < packages.length; i++) {
      log.info(chalk.green(`  ${packages[i]!} → ${versions[i]!}`));
    }
    log.info(chalk.cyan('\nIn repositories:'));
    for (const repo of repos) {
      log.info(chalk.green(`  ${repo}`));
    }

    const auto = shouldAutoConfirm(options);
    if (auto.auto) {
      log.warn(chalk.yellow(`Auto-confirmed (${auto.reason}).`));
    } else {
      const { confirm } = (await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: 'Do you want to proceed with the upgrade?',
          default: false,
        },
      ])) as { confirm: boolean };
      if (!confirm) {
        log.warn(chalk.yellow('Operation cancelled.'));
        process.exit(0);
      }
    }

    const spinner =
      log.isQuiet() || log.isJson() ? null : ora('Starting package update process...').start();

    try {
      const result = await updatePackages({
        packages,
        versions,
        repos,
        resetHard: options.resetHard === true,
        baseBranch: options.base ?? null,
      });
      if (spinner) spinner.succeed('Package update process completed successfully.');
      if (log.isJson()) {
        process.stdout.write(JSON.stringify(result) + '\n');
      }
      process.exit(result.summary.failed > 0 ? CODES.RUNTIME : CODES.SUCCESS);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (spinner) spinner.fail(`Error: ${message}`);
      else log.error(chalk.red(`Error: ${message}`));
      if (err instanceof CliError && err.hint) {
        log.error(chalk.red('  → Try: ' + err.hint));
      }
      const code = err instanceof CliError ? err.code : CODES.RUNTIME;
      process.exit(code);
    }
  });

  cmd.addHelpText(
    'after',
    `
Examples:
  Update one package across multiple repos:
    $ batch-upgrade-npm upgrade -p react --versions ^18.0.0 -r ./web ./admin

  Multiple packages, one repo, dry-run preview:
    $ batch-upgrade-npm upgrade -p lodash axios --versions ^4.17.21 ^1.4.0 -r ./api --dry-run

  JSON summary in CI:
    $ CI=true batch-upgrade-npm upgrade --json -p react --versions ^18.0.0 -r ./app > result.json
`
  );
}
