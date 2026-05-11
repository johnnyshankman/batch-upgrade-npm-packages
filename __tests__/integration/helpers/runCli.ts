import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const here = fileURLToPath(new URL('.', import.meta.url));
export const CLI_PATH = resolve(here, '../../../bin/cli.ts');

export interface RunCliOptions {
  env?: Record<string, string>;
  cwd?: string;
  stdin?: string;
  timeout?: number;
}

export interface RunCliResult {
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  killed: boolean;
}

export function runCli(args: string[] = [], opts: RunCliOptions = {}): Promise<RunCliResult> {
  const { env = {}, cwd = process.cwd(), stdin = '', timeout = 20000 } = opts;
  return new Promise((resolvePromise, rejectPromise) => {
    const proc = spawn('node', ['--import', 'tsx/esm', CLI_PATH, ...args], {
      cwd,
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let killed = false;

    proc.stdout?.on('data', (d: Buffer) => {
      stdout += d.toString();
    });
    proc.stderr?.on('data', (d: Buffer) => {
      stderr += d.toString();
    });

    const timer = setTimeout(() => {
      killed = true;
      proc.kill('SIGKILL');
    }, timeout);

    proc.on('error', (err: Error) => {
      clearTimeout(timer);
      rejectPromise(err);
    });

    proc.on('close', (code: number | null, signal: NodeJS.Signals | null) => {
      clearTimeout(timer);
      resolvePromise({ code, signal, stdout, stderr, killed });
    });

    if (stdin && proc.stdin) {
      proc.stdin.write(stdin);
    }
    proc.stdin?.end();
  });
}
