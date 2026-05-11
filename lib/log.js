const chalk = require('chalk');

const DEFAULTS = {
  quiet: false,
  verbose: false,
  debug: false,
  json: false,
  color: undefined,
  dryRun: false,
};

let cfg = { ...DEFAULTS };

function applyColorConfig() {
  if (process.env.NO_COLOR !== undefined && process.env.NO_COLOR !== '') {
    chalk.level = 0;
    return;
  }
  if (cfg.color === false) {
    chalk.level = 0;
  } else if (cfg.color === true && chalk.level === 0) {
    chalk.level = 1;
  }
}

function configure(opts = {}) {
  cfg = { ...cfg, ...opts };
  applyColorConfig();
}

function reset() {
  cfg = { ...DEFAULTS };
  applyColorConfig();
}

function getConfig() {
  return { ...cfg };
}

function isVerbose() {
  return cfg.verbose || cfg.debug;
}

function isDebug() {
  return cfg.debug;
}

function isJson() {
  return cfg.json;
}

function isQuiet() {
  return cfg.quiet;
}

function isDryRun() {
  return cfg.dryRun;
}

function writeStderr(line) {
  process.stderr.write(String(line) + '\n');
}

function writeStdout(line) {
  process.stdout.write(String(line) + '\n');
}

function info(s) {
  if (!cfg.quiet && !cfg.json) writeStderr(s);
}

function warn(s) {
  if (!cfg.quiet) writeStderr(s);
}

function error(s) {
  writeStderr(s);
}

function success(s) {
  if (!cfg.quiet && !cfg.json) writeStderr(s);
}

function debug(s) {
  if (cfg.verbose || cfg.debug) writeStderr(s);
}

function dryRun(s) {
  if (!cfg.quiet) writeStderr('[dry-run] ' + s);
}

function data(obj) {
  if (cfg.json) {
    writeStdout(typeof obj === 'string' ? obj : JSON.stringify(obj));
  } else if (!cfg.quiet) {
    writeStdout(typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2));
  }
}

module.exports = {
  configure,
  reset,
  getConfig,
  isVerbose,
  isDebug,
  isJson,
  isQuiet,
  isDryRun,
  info,
  warn,
  error,
  success,
  debug,
  dryRun,
  data,
};
