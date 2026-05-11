const execa = require('execa');

async function runCmd(file, args = [], opts = {}) {
  const { cwd, env, stream = true, input } = opts;

  const subprocess = execa(file, args, {
    cwd,
    env,
    input,
    reject: false,
    all: false,
  });

  if (stream) {
    if (subprocess.stdout) subprocess.stdout.pipe(process.stdout, { end: false });
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
