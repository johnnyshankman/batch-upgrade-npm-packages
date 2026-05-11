const execa = require('execa');
const log = require('./log');

async function runCmd(file, args = [], opts = {}) {
  const { cwd, env, input } = opts;

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
