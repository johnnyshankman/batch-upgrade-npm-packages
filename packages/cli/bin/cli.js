#!/usr/bin/env node

const { program } = require('commander');
const inquirer = require('inquirer');
const chalk = require('chalk');
const ora = require('ora');
const { updatePackages } = require('../lib/index');

// Define the program options
program
  .name('batch-upgrade-npm')
  .description('A CLI tool to upgrade npm packages across multiple repositories')
  .version('1.0.0')
  .option('-p, --packages <packages...>', 'packages to update (space separated)')
  .option('-v, --versions <versions...>', 'version ranges (space separated, matching packages order)')
  .option('-r, --repos <repos...>', 'repository paths (space separated, relative to current directory)')
  .option('-i, --interactive', 'run in interactive mode (will prompt for input)')
  .parse(process.argv);

// Main function to run the CLI
async function run() {
  const options = program.opts();
  let packages = options.packages || [];
  let versions = options.versions || [];
  let repos = options.repos || [];

  // If interactive mode or missing required parameters, prompt for input
  if (options.interactive || !packages.length || !versions.length || !repos.length) {
    console.log(chalk.cyan('Batch NPM Package Upgrader'));
    console.log(chalk.cyan('========================='));

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'packages',
        message: 'Enter packages to update (space-separated):',
        when: !packages.length,
        filter: (input) => input.split(' ').filter(Boolean)
      },
      {
        type: 'input',
        name: 'versions',
        message: 'Enter version ranges (space-separated, matching the order of packages):',
        when: !versions.length,
        filter: (input) => input.split(' ').filter(Boolean),
        validate: (input, answers) => {
          const pkgs = packages.length ? packages : answers.packages;
          return input.length === pkgs.length ?
            true :
            `Number of versions (${input.length}) must match number of packages (${pkgs.length})`;
        }
      },
      {
        type: 'input',
        name: 'repos',
        message: 'Enter repository paths (space-separated):',
        when: !repos.length,
        filter: (input) => input.split(' ').filter(Boolean)
      }
    ]);

    // Merge command line options with interactive answers
    packages = packages.length ? packages : answers.packages;
    versions = versions.length ? versions : answers.versions;
    repos = repos.length ? repos : answers.repos;
  }

  // Validate requirements
  if (packages.length !== versions.length) {
    console.error(chalk.red('Error: Number of packages and versions must match.'));
    process.exit(1);
  }

  if (packages.length === 0) {
    console.error(chalk.red('Error: No packages specified.'));
    process.exit(1);
  }

  if (repos.length === 0) {
    console.error(chalk.red('Error: No repositories specified.'));
    process.exit(1);
  }

  // Display what we're going to do
  console.log(chalk.cyan('\nUpgrading packages:'));
  for (let i = 0; i < packages.length; i++) {
    console.log(chalk.green(`  ${packages[i]} → ${versions[i]}`));
  }

  console.log(chalk.cyan('\nIn repositories:'));
  for (const repo of repos) {
    console.log(chalk.green(`  ${repo}`));
  }

  // Confirm before proceeding
  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: 'Do you want to proceed with the upgrade?',
      default: false
    }
  ]);

  if (!confirm) {
    console.log(chalk.yellow('Operation cancelled.'));
    process.exit(0);
  }

  // Start the upgrade process
  const spinner = ora('Starting package update process...').start();

  try {
    await updatePackages({
      packages,
      versions,
      repos
    });

    spinner.succeed('Package update process completed successfully.');
  } catch (error) {
    spinner.fail(`Error: ${error.message}`);
    process.exit(1);
  }
}

// Run the CLI
run().catch(error => {
  console.error(chalk.red(`Error: ${error.message}`));
  process.exit(1);
});
