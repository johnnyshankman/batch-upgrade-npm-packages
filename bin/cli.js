#!/usr/bin/env node

const { program } = require('commander');
const inquirer = require('inquirer');
const chalk = require('chalk');
const ora = require('ora');
const pkg = require('../package.json');
const { updatePackages } = require('../lib/index');

program
  .name('batch-upgrade-npm')
  .description('A CLI tool to upgrade npm packages across multiple repositories')
  .version(pkg.version)
  .option('-p, --packages <packages...>', 'packages to update (space separated)')
  .option(
    '--versions <versions...>',
    'version ranges (space separated, matching packages order)'
  )
  .option(
    '-r, --repos <repos...>',
    'repository paths (space separated, relative to current directory)'
  )
  .option('-i, --interactive', 'run in interactive mode (will prompt for input)')
  .option('-y, --yes', 'skip confirmation prompt (also implied by CI=true or non-TTY stdin)')
  .option(
    '--reset-hard',
    'discard uncommitted changes in target repos before updating (DESTRUCTIVE)'
  )
  .exitOverride((err) => {
    if (err.code === 'commander.helpDisplayed' || err.code === 'commander.version') {
      process.exit(0);
    }
    process.exit(2);
  });

program.parse(process.argv);

function shouldAutoConfirm(options) {
  if (options.yes) return { auto: true, reason: '--yes' };
  if (process.env.CI === 'true') return { auto: true, reason: 'CI=true' };
  if (!process.stdin.isTTY) return { auto: true, reason: 'non-TTY stdin' };
  return { auto: false };
}

async function run() {
  const options = program.opts();
  let packages = options.packages || [];
  let versions = options.versions || [];
  let repos = options.repos || [];

  const hasAllRequiredArgs = packages.length && versions.length && repos.length;
  const interactive = options.interactive || !hasAllRequiredArgs;

  if (interactive) {
    if (!process.stdin.isTTY) {
      console.error(
        chalk.red(
          'Error: Missing required arguments and stdin is not a TTY (non-interactive environment).'
        )
      );
      console.error(
        chalk.red(
          '  → Try: pass --packages, --versions, and --repos explicitly, or set them via env (BATCH_UPGRADE_*)'
        )
      );
      process.exit(2);
    }

    console.log(chalk.cyan('Batch NPM Package Upgrader'));
    console.log(chalk.cyan('========================='));

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'packages',
        message: 'Enter packages to update (space-separated):',
        when: !packages.length,
        filter: (input) => input.split(' ').filter(Boolean),
      },
      {
        type: 'input',
        name: 'versions',
        message: 'Enter version ranges (space-separated, matching the order of packages):',
        when: !versions.length,
        filter: (input) => input.split(' ').filter(Boolean),
        validate: (input, partial) => {
          const pkgs = packages.length ? packages : partial.packages;
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
        filter: (input) => input.split(' ').filter(Boolean),
      },
    ]);

    packages = packages.length ? packages : answers.packages;
    versions = versions.length ? versions : answers.versions;
    repos = repos.length ? repos : answers.repos;
  }

  if (packages.length !== versions.length) {
    console.error(chalk.red('Error: Number of packages and versions must match.'));
    process.exit(2);
  }
  if (packages.length === 0) {
    console.error(chalk.red('Error: No packages specified.'));
    process.exit(2);
  }
  if (repos.length === 0) {
    console.error(chalk.red('Error: No repositories specified.'));
    process.exit(2);
  }

  console.log(chalk.cyan('\nUpgrading packages:'));
  for (let i = 0; i < packages.length; i++) {
    console.log(chalk.green(`  ${packages[i]} → ${versions[i]}`));
  }
  console.log(chalk.cyan('\nIn repositories:'));
  for (const repo of repos) {
    console.log(chalk.green(`  ${repo}`));
  }

  const auto = shouldAutoConfirm(options);
  if (auto.auto) {
    console.error(chalk.yellow(`Auto-confirmed (${auto.reason}).`));
  } else {
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Do you want to proceed with the upgrade?',
        default: false,
      },
    ]);
    if (!confirm) {
      console.log(chalk.yellow('Operation cancelled.'));
      process.exit(0);
    }
  }

  const spinner = ora('Starting package update process...').start();

  try {
    await updatePackages({
      packages,
      versions,
      repos,
      resetHard: options.resetHard === true,
    });
    spinner.succeed('Package update process completed successfully.');
  } catch (error) {
    spinner.fail(`Error: ${error.message}`);
    process.exit(typeof error.code === 'number' ? error.code : 1);
  }
}

run().catch((error) => {
  console.error(chalk.red(`Error: ${error.message}`));
  process.exit(typeof error.code === 'number' ? error.code : 1);
});
