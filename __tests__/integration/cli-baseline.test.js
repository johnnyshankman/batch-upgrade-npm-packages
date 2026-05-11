const { runCli } = require('./helpers/runCli');

describe('CLI baseline (passes against current code; documents present behavior)', () => {
  describe('--version / -V', () => {
    it('--version exits 0 and prints a semver string on stdout', async () => {
      const r = await runCli(['--version']);
      expect(r.code).toBe(0);
      expect(r.stdout).toMatch(/^\d+\.\d+\.\d+\s*$/);
    });

    it('-V is an alias for --version', async () => {
      const r = await runCli(['-V']);
      expect(r.code).toBe(0);
      expect(r.stdout).toMatch(/^\d+\.\d+\.\d+\s*$/);
    });
  });

  describe('--help / -h', () => {
    it('--help exits 0', async () => {
      const r = await runCli(['--help']);
      expect(r.code).toBe(0);
    });

    it('--help output contains Usage and Options sections', async () => {
      const r = await runCli(['--help']);
      expect(r.stdout).toContain('Usage:');
      expect(r.stdout).toContain('Options:');
    });

    it('--help documents the core flags', async () => {
      const r = await runCli(['--help']);
      for (const flag of ['--packages', '--versions', '--repos', '--interactive', '--help']) {
        expect(r.stdout).toContain(flag);
      }
    });

    it('-h is an alias for --help', async () => {
      const r = await runCli(['-h']);
      expect(r.code).toBe(0);
      expect(r.stdout).toContain('Usage:');
    });
  });

  describe('unknown options', () => {
    it('rejects --bogus with a non-zero exit', async () => {
      const r = await runCli(['--bogus']);
      expect(r.code).not.toBe(0);
      expect(r.stderr + r.stdout).toMatch(/unknown option/i);
    });
  });
});
