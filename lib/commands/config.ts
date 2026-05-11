import type { Command } from 'commander';
import chalk from 'chalk';
import * as log from '../log.js';
import { CODES } from '../exit-codes.js';

const KEYS = {
  packages: 'BATCH_UPGRADE_PACKAGES',
  versions: 'BATCH_UPGRADE_VERSIONS',
  repos: 'BATCH_UPGRADE_REPOS',
  'base-branch': 'BATCH_UPGRADE_BASE_BRANCH',
  yes: 'BATCH_UPGRADE_YES',
} as const;

type ConfigKey = keyof typeof KEYS;

function isConfigKey(k: string): k is ConfigKey {
  return Object.prototype.hasOwnProperty.call(KEYS, k);
}

function effectiveValue(key: ConfigKey): string | undefined {
  return process.env[KEYS[key]];
}

export default function registerConfig(program: Command): void {
  const cfg = program
    .command('config')
    .usage('<command> [options]')
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
    .usage('<key> [options]')
    .description('Print the effective value for a single key')
    .action((key: string) => {
      if (!isConfigKey(key)) {
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
      for (const key of Object.keys(KEYS) as ConfigKey[]) {
        const v = effectiveValue(key);
        const display = v === undefined ? chalk.gray('(unset)') : v;
        process.stdout.write(`${key}: ${display}\n`);
      }
    });

  cfg
    .command('set <key> <value>')
    .usage('<key> <value> [options]')
    .description(
      'Informational: print the `export …` line for <key>=<value> (does not persist anything to disk)'
    )
    .action((key: string, value: string) => {
      if (!isConfigKey(key)) {
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
}
