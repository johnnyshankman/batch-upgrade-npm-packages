import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { runCmd } from '../lib/runCmd.js';

describe('runCmd', () => {
  it('returns success on exit code 0', async () => {
    const r = await runCmd('true', []);
    expect(r.success).toBe(true);
    expect(r.exitCode).toBe(0);
  });

  it('returns success:false on non-zero exit', async () => {
    const r = await runCmd('false', []);
    expect(r.success).toBe(false);
    expect(r.exitCode).not.toBe(0);
  });

  it('passes args without shell interpretation (no $VAR expansion)', async () => {
    const r = await runCmd('echo', ['$HOME', '$(whoami)']);
    expect(r.success).toBe(true);
    expect(r.stdout).toBe('$HOME $(whoami)');
  });

  it('passes args without shell interpretation (no quote/backtick injection)', async () => {
    const malicious = 'foo"; touch /tmp/should-not-exist-xyz; echo "bar';
    const r = await runCmd('echo', [malicious]);
    expect(r.success).toBe(true);
    expect(r.stdout).toBe(malicious);
    expect(fs.existsSync('/tmp/should-not-exist-xyz')).toBe(false);
  });

  it('honors cwd option', async () => {
    const r = await runCmd('pwd', [], { cwd: '/tmp' });
    expect(r.success).toBe(true);
    expect(r.stdout.trim()).toMatch(/^\/(?:private\/)?tmp$/);
  });

  it('captures stderr separately from stdout', async () => {
    const r = await runCmd('sh', ['-c', 'echo out; echo err >&2']);
    expect(r.stdout.trim()).toBe('out');
    expect(r.stderr.trim()).toBe('err');
  });
});
