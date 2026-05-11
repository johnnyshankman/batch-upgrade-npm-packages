import chalk from 'chalk';
import type { ChalkInstance } from 'chalk';

export interface LogConfig {
  quiet: boolean;
  verbose: boolean;
  debug: boolean;
  json: boolean;
  color: boolean | undefined;
  dryRun: boolean;
}

const DEFAULTS: LogConfig = {
  quiet: false,
  verbose: false,
  debug: false,
  json: false,
  color: undefined,
  dryRun: false,
};

let cfg: LogConfig = { ...DEFAULTS };

type Level = ChalkInstance['level'];

function applyColorConfig(): void {
  if (process.env['NO_COLOR'] !== undefined && process.env['NO_COLOR'] !== '') {
    chalk.level = 0 as Level;
    return;
  }
  if (cfg.color === false) {
    chalk.level = 0 as Level;
  } else if (cfg.color === true && chalk.level === 0) {
    chalk.level = 1 as Level;
  }
}

export function configure(opts: Partial<LogConfig> = {}): void {
  cfg = { ...cfg, ...opts };
  applyColorConfig();
}

export function reset(): void {
  cfg = { ...DEFAULTS };
  applyColorConfig();
}

export function getConfig(): LogConfig {
  return { ...cfg };
}

export function isVerbose(): boolean {
  return cfg.verbose || cfg.debug;
}

export function isDebug(): boolean {
  return cfg.debug;
}

export function isJson(): boolean {
  return cfg.json;
}

export function isQuiet(): boolean {
  return cfg.quiet;
}

export function isDryRun(): boolean {
  return cfg.dryRun;
}

function writeStderr(line: string): void {
  process.stderr.write(String(line) + '\n');
}

function writeStdout(line: string): void {
  process.stdout.write(String(line) + '\n');
}

export function info(s: string): void {
  if (!cfg.quiet && !cfg.json) writeStderr(s);
}

export function warn(s: string): void {
  if (!cfg.quiet) writeStderr(s);
}

export function error(s: string): void {
  writeStderr(s);
}

export function success(s: string): void {
  if (!cfg.quiet && !cfg.json) writeStderr(s);
}

export function debug(s: string): void {
  if (cfg.verbose || cfg.debug) writeStderr(s);
}

export function dryRun(s: string): void {
  if (!cfg.quiet) writeStderr('[dry-run] ' + s);
}

export function data(obj: unknown): void {
  if (cfg.json) {
    writeStdout(typeof obj === 'string' ? obj : JSON.stringify(obj));
  } else if (!cfg.quiet) {
    writeStdout(typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2));
  }
}
