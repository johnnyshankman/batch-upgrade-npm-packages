const fs = require('fs');
const path = require('path');
const { runCli } = require('./helpers/runCli');
const { makeRepo } = require('./helpers/gitFixture');
const { makeMockGh } = require('./helpers/mockGh');

const pkg = require('../../package.json');

// CLI Contract Test Matrix
// These tests describe the target CLI behavior for v2.0.0.
// They are unskipped as each plan-PR lands. The `unlocks` tag in each
// `describe.skip` block tells you which PR enables that test.

describe.skip('CLI contract — strict version sync (unlocks: PR1)', () => {
  it('--version equals package.json version', async () => {
    const r = await runCli(['--version']);
    expect(r.code).toBe(0);
    expect(r.stdout.trim()).toBe(pkg.version);
  });
});

describe.skip('CLI contract — exit codes (unlocks: PR5)', () => {
  it('returns exit 2 for usage errors (unknown option)', async () => {
    const r = await runCli(['--bogus']);
    expect(r.code).toBe(2);
  });

  it('returns exit 2 for mismatched packages/versions counts', async () => {
    const r = await runCli(['--packages', 'a', 'b', '--versions', '1.0.0', '--repos', 'x', '--yes']);
    expect(r.code).toBe(2);
    expect(r.stderr).toMatch(/match/i);
  });

  it('returns exit 3 when gh auth fails', async () => {
    const mockGh = makeMockGh({ failAuth: true });
    const repo = makeRepo();
    try {
      const r = await runCli(
        ['--packages', 'react', '--versions', '^18.0.0', '--repos', repo.dir, '--yes'],
        { env: { PATH: mockGh.envPath } }
      );
      expect(r.code).toBe(3);
      expect(r.stderr).toMatch(/gh auth login/);
    } finally {
      repo.cleanup();
      mockGh.cleanup();
    }
  });

  it('returns exit 5 when target repo has uncommitted changes and --reset-hard is not passed', async () => {
    const mockGh = makeMockGh();
    const repo = makeRepo({ dirty: true });
    try {
      const r = await runCli(
        ['--packages', 'react', '--versions', '^18.0.0', '--repos', repo.dir, '--yes'],
        { env: { PATH: mockGh.envPath } }
      );
      expect(r.code).toBe(5);
      expect(r.stderr).toMatch(/--reset-hard|stash/);
      expect(fs.existsSync(path.join(repo.dir, 'dirty.txt'))).toBe(true);
    } finally {
      repo.cleanup();
      mockGh.cleanup();
    }
  });
});

describe.skip('CLI contract — non-interactive / automation (unlocks: PR1)', () => {
  it('exits 2 with helpful message when run non-interactively without --yes', async () => {
    const r = await runCli(['--packages', 'react', '--versions', '^18.0.0', '--repos', './nowhere']);
    expect(r.code).toBe(2);
    expect(r.stderr).toMatch(/non-interactive|--yes/);
  });

  it('CI=true auto-confirms without --yes', async () => {
    const mockGh = makeMockGh();
    const repo = makeRepo();
    try {
      const r = await runCli(
        ['--packages', 'react', '--versions', '^18.0.0', '--repos', repo.dir, '--dry-run'],
        { env: { CI: 'true', PATH: mockGh.envPath } }
      );
      expect(r.code).toBe(0);
      expect(r.stderr).toMatch(/Auto-confirmed|CI/);
    } finally {
      repo.cleanup();
      mockGh.cleanup();
    }
  });
});

describe.skip('CLI contract — --dry-run preserves state (unlocks: PR4)', () => {
  it('makes no changes to target repos', async () => {
    const mockGh = makeMockGh();
    const repo = makeRepo();
    const before = repo.headSha;
    try {
      const r = await runCli(
        ['--packages', 'react', '--versions', '^18.0.0', '--repos', repo.dir, '--yes', '--dry-run'],
        { env: { PATH: mockGh.envPath } }
      );
      expect(r.code).toBe(0);
      expect(r.stderr).toMatch(/\[dry-run\]/);
      expect(repo.headNow()).toBe(before);
      expect(repo.status()).toBe('');
    } finally {
      repo.cleanup();
      mockGh.cleanup();
    }
  });

  it('shell-injection regression: malicious package name does not execute', async () => {
    const mockGh = makeMockGh();
    const repo = makeRepo();
    const sentinel = path.join(repo.root, `HACK_${Date.now()}_${Math.random().toString(36).slice(2)}`);
    try {
      await runCli(
        [
          '--packages',
          `react"; touch '${sentinel}'; echo "`,
          '--versions',
          '^18.0.0',
          '--repos',
          repo.dir,
          '--yes',
          '--dry-run',
        ],
        { env: { PATH: mockGh.envPath } }
      );
      expect(fs.existsSync(sentinel)).toBe(false);
    } finally {
      repo.cleanup();
      mockGh.cleanup();
    }
  });
});

describe.skip('CLI contract — --json output (unlocks: PR6)', () => {
  it('--dry-run --json emits parsable JSON', async () => {
    const mockGh = makeMockGh();
    const repo = makeRepo();
    try {
      const r = await runCli(
        [
          '--packages',
          'react',
          '--versions',
          '^18.0.0',
          '--repos',
          repo.dir,
          '--yes',
          '--dry-run',
          '--json',
        ],
        { env: { PATH: mockGh.envPath } }
      );
      expect(r.code).toBe(0);
      const parsed = JSON.parse(r.stdout);
      expect(parsed).toHaveProperty('summary');
      expect(parsed).toHaveProperty('repositories');
      expect(Array.isArray(parsed.repositories)).toBe(true);
    } finally {
      repo.cleanup();
      mockGh.cleanup();
    }
  });
});

describe.skip('CLI contract — color (unlocks: PR3)', () => {
  it('--no-color strips ANSI escape sequences from help', async () => {
    const r = await runCli(['--no-color', '--help']);
    expect(r.code).toBe(0);
    // eslint-disable-next-line no-control-regex
    expect(r.stdout).not.toMatch(/\x1b\[/);
  });

  it('NO_COLOR=1 strips ANSI escape sequences from help', async () => {
    const r = await runCli(['--help'], { env: { NO_COLOR: '1' } });
    expect(r.code).toBe(0);
    // eslint-disable-next-line no-control-regex
    expect(r.stdout).not.toMatch(/\x1b\[/);
  });
});

describe.skip('CLI contract — logging flags (unlocks: PR3)', () => {
  it('--quiet --verbose is rejected with exit 2', async () => {
    const r = await runCli(['--quiet', '--verbose']);
    expect(r.code).toBe(2);
    expect(r.stderr).toMatch(/mutually exclusive/i);
  });
});

describe.skip('CLI contract — env vars (unlocks: PR7)', () => {
  it('BATCH_UPGRADE_PACKAGES + _VERSIONS + _REPOS supplies defaults', async () => {
    const mockGh = makeMockGh();
    const repo = makeRepo();
    try {
      const r = await runCli(['--yes', '--dry-run'], {
        env: {
          PATH: mockGh.envPath,
          BATCH_UPGRADE_PACKAGES: 'react',
          BATCH_UPGRADE_VERSIONS: '^18.0.0',
          BATCH_UPGRADE_REPOS: repo.dir,
        },
      });
      expect(r.code).toBe(0);
    } finally {
      repo.cleanup();
      mockGh.cleanup();
    }
  });
});

describe.skip('CLI contract — base-branch auto-detect (unlocks: PR7)', () => {
  it('repo with master branch (no main) auto-detects master', async () => {
    const mockGh = makeMockGh();
    const repo = makeRepo({ branch: 'master' });
    try {
      const r = await runCli(
        [
          '--packages',
          'react',
          '--versions',
          '^18.0.0',
          '--repos',
          repo.dir,
          '--yes',
          '--dry-run',
          '--verbose',
        ],
        { env: { PATH: mockGh.envPath } }
      );
      expect(r.code).toBe(0);
      expect(r.stderr.toLowerCase()).toMatch(/master/);
    } finally {
      repo.cleanup();
      mockGh.cleanup();
    }
  });
});

describe.skip('CLI contract — subcommands (unlocks: PR8)', () => {
  it('upgrade --help shows the upgrade subcommand help', async () => {
    const r = await runCli(['upgrade', '--help']);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('upgrade');
  });

  it('completion bash emits a non-empty shell script', async () => {
    const r = await runCli(['completion', 'bash']);
    expect(r.code).toBe(0);
    expect(r.stdout.length).toBeGreaterThan(0);
  });

  it('legacy form prints deprecation warning to stderr and still works', async () => {
    const mockGh = makeMockGh();
    const repo = makeRepo();
    try {
      const r = await runCli(
        ['--packages', 'react', '--versions', '^18.0.0', '--repos', repo.dir, '--yes', '--dry-run'],
        { env: { PATH: mockGh.envPath } }
      );
      expect(r.code).toBe(0);
      expect(r.stderr).toMatch(/[Dd]eprecat/);
    } finally {
      repo.cleanup();
      mockGh.cleanup();
    }
  });
});
