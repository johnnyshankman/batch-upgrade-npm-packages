const { runCmd } = require('../lib/runCmd');

describe('runCmd', () => {
  it('returns success on exit code 0', async () => {
    const r = await runCmd('true', [], { stream: false });
    expect(r.success).toBe(true);
    expect(r.exitCode).toBe(0);
  });

  it('returns success:false on non-zero exit', async () => {
    const r = await runCmd('false', [], { stream: false });
    expect(r.success).toBe(false);
    expect(r.exitCode).not.toBe(0);
  });

  it('passes args without shell interpretation (no $VAR expansion)', async () => {
    const r = await runCmd('echo', ['$HOME', '$(whoami)'], { stream: false });
    expect(r.success).toBe(true);
    expect(r.stdout).toBe('$HOME $(whoami)');
  });

  it('passes args without shell interpretation (no quote/backtick injection)', async () => {
    const malicious = 'foo"; touch /tmp/should-not-exist-xyz; echo "bar';
    const r = await runCmd('echo', [malicious], { stream: false });
    expect(r.success).toBe(true);
    expect(r.stdout).toBe(malicious);
    const fs = require('fs');
    expect(fs.existsSync('/tmp/should-not-exist-xyz')).toBe(false);
  });

  it('honors cwd option', async () => {
    const r = await runCmd('pwd', [], { stream: false, cwd: '/tmp' });
    expect(r.success).toBe(true);
    expect(r.stdout.trim()).toMatch(/^\/(?:private\/)?tmp$/);
  });

  it('captures stderr separately from stdout', async () => {
    const r = await runCmd('sh', ['-c', 'echo out; echo err >&2'], { stream: false });
    expect(r.stdout.trim()).toBe('out');
    expect(r.stderr.trim()).toBe('err');
  });
});
