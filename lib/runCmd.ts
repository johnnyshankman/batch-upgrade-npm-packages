import { execa } from 'execa';
import * as log from './log.js';

export interface RunCmdOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  input?: string | Uint8Array;
  mutating?: boolean;
}

export interface RunCmdResult {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  output: string;
}

export async function runCmd(
  file: string,
  args: string[] = [],
  opts: RunCmdOptions = {}
): Promise<RunCmdResult> {
  const { cwd, env, input, mutating = false } = opts;

  if (mutating && log.isDryRun()) {
    log.dryRun(`Would run: ${file} ${args.join(' ')}`);
    return { success: true, exitCode: 0, stdout: '', stderr: '', output: '' };
  }

  const subprocess = execa(file, args, {
    ...(cwd !== undefined ? { cwd } : {}),
    ...(env !== undefined ? { env: env as Record<string, string | undefined> } : {}),
    ...(input !== undefined ? { input } : {}),
    reject: false,
  });

  if (log.isVerbose()) {
    subprocess.stdout?.pipe(process.stderr, { end: false });
    subprocess.stderr?.pipe(process.stderr, { end: false });
  }

  const result = await subprocess;

  const exitCode = typeof result.exitCode === 'number' ? result.exitCode : result.failed ? 1 : 0;
  const stdout = typeof result.stdout === 'string' ? result.stdout : '';
  const stderr = typeof result.stderr === 'string' ? result.stderr : '';

  return {
    success: exitCode === 0 && !result.failed,
    exitCode,
    stdout,
    stderr,
    output: stdout + stderr,
  };
}
