const path = require('path');
const { spawn } = require('child_process');

const CLI_PATH = path.resolve(__dirname, '../../../bin/cli.js');

function runCli(args = [], opts = {}) {
  const { env = {}, cwd = process.cwd(), stdin = '', timeout = 20000 } = opts;
  return new Promise((resolve, reject) => {
    const proc = spawn('node', [CLI_PATH, ...args], {
      cwd,
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let killed = false;

    proc.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    proc.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    const timer = setTimeout(() => {
      killed = true;
      proc.kill('SIGKILL');
    }, timeout);

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    proc.on('close', (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal, stdout, stderr, killed });
    });

    if (stdin) {
      proc.stdin.write(stdin);
    }
    proc.stdin.end();
  });
}

module.exports = { runCli, CLI_PATH };
