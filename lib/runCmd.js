const execa = require('execa');
const log = require('./log');

async function runCmd(file, args = [], opts = {}) {
  const { cwd, env, input, mutating = false } = opts;

  if (mutating && log.isDryRun()) {
    log.dryRun(`Would run: ${file} ${args.join(' ')}`);
    return { success: true, exitCode: 0, stdout: '', stderr: '', output: '' };
  }

  const subprocess = execa(file, args, {
    cwd,
    env,
    input,
    reject: false,
    all: false,
  });

  if (log.isVerbose()) {
    if (subprocess.stdout) subprocess.stdout.pipe(process.stderr, { end: false });
    if (subprocess.stderr) subprocess.stderr.pipe(process.stderr, { end: false });
  }

  const result = await subprocess;

  return {
    success: result.exitCode === 0 && !result.failed,
    exitCode: typeof result.exitCode === 'number' ? result.exitCode : 1,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    output: (result.stdout || '') + (result.stderr || ''),
  };
}

module.exports = { runCmd };
