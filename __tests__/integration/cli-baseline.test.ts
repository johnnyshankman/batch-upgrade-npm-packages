import { describe, it, expect } from 'vitest';
import { runCli } from './helpers/runCli.js';

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

    it('--help documents global flags and the subcommand list', async () => {
      const r = await runCli(['--help']);
      expect(r.stdout).toContain('upgrade');
      expect(r.stdout).toContain('config');
      expect(r.stdout).toContain('completion');
      expect(r.stdout).toContain('--quiet');
      expect(r.stdout).toContain('--verbose');
      expect(r.stdout).toContain('--no-color');
    });

    it('upgrade --help documents the upgrade flags', async () => {
      const r = await runCli(['upgrade', '--help']);
      expect(r.code).toBe(0);
      for (const flag of ['--packages', '--versions', '--repos', '--interactive']) {
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
