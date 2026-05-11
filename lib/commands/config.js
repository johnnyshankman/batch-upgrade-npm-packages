const chalk = require('chalk');
const log = require('../log');
const { CODES } = require('../exit-codes');

const KEYS = {
  packages: 'BATCH_UPGRADE_PACKAGES',
  versions: 'BATCH_UPGRADE_VERSIONS',
  repos: 'BATCH_UPGRADE_REPOS',
  'base-branch': 'BATCH_UPGRADE_BASE_BRANCH',
  yes: 'BATCH_UPGRADE_YES',
};

function effectiveValue(key) {
  const envName = KEYS[key];
  if (!envName) return undefined;
  return process.env[envName];
}

module.exports = function registerConfig(program) {
  const cfg = program
    .command('config')
    .description('Inspect effective configuration resolved from environment variables')
    .addHelpText(
      'after',
      `
Configuration sources (highest precedence first):
  1. Command-line flags (e.g. --packages react)
  2. Environment variables: ${Object.values(KEYS).join(', ')}

Persistent config files are not yet supported. To set a default,
export the corresponding env var in your shell profile.
`
    );

  cfg
    .command('get <key>')
    .description('Print the effective value for a single key')
    .action((key) => {
      if (!Object.prototype.hasOwnProperty.call(KEYS, key)) {
        log.error(chalk.red(`Error: unknown config key '${key}'.`));
        log.error(chalk.red(`  → Try: one of ${Object.keys(KEYS).join(', ')}`));
        process.exit(CODES.USAGE);
      }
      const v = effectiveValue(key);
      if (v === undefined) {
        log.info(chalk.yellow(`(unset; default for ${key} comes from explicit --${key} flag)`));
        process.exit(0);
      }
      process.stdout.write(v + '\n');
    });

  cfg
    .command('list')
    .description('Print every effective configuration value')
    .action(() => {
      for (const key of Object.keys(KEYS)) {
        const v = effectiveValue(key);
        const display = v === undefined ? chalk.gray('(unset)') : v;
        process.stdout.write(`${key}: ${display}\n`);
      }
    });

  cfg
    .command('set <key> <value>')
    .description('Persistent config files are not supported; prints the env var to export instead')
    .action((key, value) => {
      if (!Object.prototype.hasOwnProperty.call(KEYS, key)) {
        log.error(chalk.red(`Error: unknown config key '${key}'.`));
        log.error(chalk.red(`  → Try: one of ${Object.keys(KEYS).join(', ')}`));
        process.exit(CODES.USAGE);
      }
      const envName = KEYS[key];
      log.warn(
        chalk.yellow(
          `Persistent config files are not yet supported. To set ${key}, export the env var instead:`
        )
      );
      process.stdout.write(`export ${envName}=${JSON.stringify(value)}\n`);
    });
};
