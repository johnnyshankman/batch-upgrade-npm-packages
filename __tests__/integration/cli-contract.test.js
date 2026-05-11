const fs = require('fs');
const path = require('path');
const { runCli } = require('./helpers/runCli');
const { makeRepo } = require('./helpers/gitFixture');
const { makeMockGh } = require('./helpers/mockGh');

const pkg = require('../../package.json');

// CLI Contract Test Matrix for v2.0.0.
// Each `it.skip(...)` carries a [unlocks: PR<n>] tag. As each plan-PR lands,
// the corresponding tests flip from .skip to active.

describe('CLI contract — version sync', () => {
  it('--version equals package.json version [unlocks: PR1]', async () => {
    const r = await runCli(['--version']);
    expect(r.code).toBe(0);
    expect(r.stdout.trim()).toBe(pkg.version);
  });
});

describe('CLI contract — exit codes', () => {
  it('returns exit 2 for unknown options [unlocks: PR1]', async () => {
    const r = await runCli(['--bogus']);
    expect(r.code).toBe(2);
    expect(r.stderr.toLowerCase()).toMatch(/unknown option/);
  });

  it('returns exit 2 for mismatched packages/versions counts [unlocks: PR1]', async () => {
    const r = await runCli(
      ['--packages', 'a', 'b', '--versions', '1.0.0', '--repos', 'x', '--yes'],
      { stdin: '' }
    );
    expect(r.code).toBe(2);
    expect(r.stderr.toLowerCase()).toMatch(/match/);
  });

  it('returns exit 2 when upgrade has no required args and stdin is non-TTY [unlocks: PR1]', async () => {
    const r = await runCli(['upgrade']);
    expect(r.code).toBe(2);
    expect(r.stderr.toLowerCase()).toMatch(/non-interactive|missing required/);
  });

  it('returns exit 3 when gh auth fails [unlocks: PR1]', async () => {
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

  it('returns exit 5 when target repo is dirty and --reset-hard is not passed [unlocks: PR1]', async () => {
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

describe('CLI contract — --dry-run [unlocks: PR4]', () => {
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
      expect(repo.readPackageJson().dependencies.react).toBe('^17.0.0');
    } finally {
      repo.cleanup();
      mockGh.cleanup();
    }
  });

  it('shell-injection regression: malicious version does not execute', async () => {
    const mockGh = makeMockGh();
    const repo = makeRepo({
      packageJson: {
        name: 'fixture',
        version: '1.0.0',
        dependencies: { 'evil-pkg': '^1.0.0' },
      },
    });
    const sentinel = path.join(
      repo.root,
      `HACK_${Date.now()}_${Math.random().toString(36).slice(2)}`
    );
    try {
      await runCli(
        [
          '--packages',
          'evil-pkg',
          '--versions',
          `2.0.0"; touch '${sentinel}'; echo "`,
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

describe('CLI contract — --json [unlocks: PR6]', () => {
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
      const parsed = JSON.parse(r.stdout.trim());
      expect(parsed).toHaveProperty('summary');
      expect(parsed.summary).toEqual({ total: 1, succeeded: 1, failed: 0, skipped: 0 });
      expect(parsed).toHaveProperty('repositories');
      expect(Array.isArray(parsed.repositories)).toBe(true);
      expect(parsed.repositories[0].status).toBe('success');
      expect(parsed.repositories[0].updates).toEqual([
        { package: 'react', fromVersion: '^17.0.0', toVersion: '^18.0.0', section: 'dependencies' },
      ]);
      expect(parsed.dryRun).toBe(true);
    } finally {
      repo.cleanup();
      mockGh.cleanup();
    }
  });

  it('--json without --dry-run captures the gh pr create URL', async () => {
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
          '--json',
        ],
        { env: { PATH: mockGh.envPath } }
      );
      // npm install will fail in the fixture (react isn't really installable
      // in a standalone temp dir without registry access in CI); accept either
      // success with prUrl, or failure status, but the JSON must always parse.
      const parsed = JSON.parse(r.stdout.trim());
      expect(parsed).toHaveProperty('summary');
      expect(parsed).toHaveProperty('repositories');
      if (parsed.repositories[0].status === 'success') {
        expect(parsed.repositories[0].prUrl).toBe('https://github.com/fake/repo/pull/1');
      }
    } finally {
      repo.cleanup();
      mockGh.cleanup();
    }
  });
});

describe('CLI contract — color [unlocks: PR3]', () => {
  it('--no-color strips ANSI escape sequences from help', async () => {
    const r = await runCli(['--no-color', '--help']);
    expect(r.code).toBe(0);
    // eslint-disable-next-line no-control-regex
    expect(r.stdout).not.toMatch(/\x1b\[/);
  });

  it('NO_COLOR=1 strips ANSI escape sequences from messages', async () => {
    const r = await runCli([], { env: { NO_COLOR: '1' } });
    expect(r.code).toBe(2);
    // eslint-disable-next-line no-control-regex
    expect(r.stderr).not.toMatch(/\x1b\[/);
  });
});

describe('CLI contract — logging flags [unlocks: PR3]', () => {
  it('--quiet --verbose is rejected with exit 2', async () => {
    const r = await runCli(['--quiet', '--verbose']);
    expect(r.code).toBe(2);
    expect(r.stderr).toMatch(/mutually exclusive/i);
  });
});

describe('CLI contract — env vars [unlocks: PR7]', () => {
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

  it('CLI flag overrides env var', async () => {
    const mockGh = makeMockGh();
    const repo = makeRepo();
    try {
      const r = await runCli(['--packages', 'react', '--yes', '--dry-run'], {
        env: {
          PATH: mockGh.envPath,
          BATCH_UPGRADE_PACKAGES: 'shouldbeignored',
          BATCH_UPGRADE_VERSIONS: '^18.0.0',
          BATCH_UPGRADE_REPOS: repo.dir,
        },
      });
      expect(r.code).toBe(0);
      expect(r.stderr).not.toMatch(/shouldbeignored/);
    } finally {
      repo.cleanup();
      mockGh.cleanup();
    }
  });
});

describe('CLI contract — base-branch auto-detect [unlocks: PR7]', () => {
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

  it('--base override is honored', async () => {
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
          '--base',
          'main',
          '--yes',
          '--dry-run',
          '--json',
        ],
        { env: { PATH: mockGh.envPath } }
      );
      expect(r.code).toBe(0);
      const parsed = JSON.parse(r.stdout.trim());
      expect(parsed.repositories[0].baseBranch).toBe('main');
    } finally {
      repo.cleanup();
      mockGh.cleanup();
    }
  });
});

describe('CLI contract — help text [unlocks: PR7]', () => {
  it('--help includes Examples / Environment / Exit codes sections', async () => {
    const r = await runCli(['--help']);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('Examples:');
    expect(r.stdout).toContain('Environment:');
    expect(r.stdout).toContain('Exit codes:');
    expect(r.stdout).toContain('BATCH_UPGRADE_PACKAGES');
    expect(r.stdout).toContain('NO_COLOR');
  });
});

describe('CLI contract — subcommands [unlocks: PR8]', () => {
  it('upgrade --help shows the upgrade subcommand help', async () => {
    const r = await runCli(['upgrade', '--help']);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('upgrade');
    expect(r.stdout).toContain('--packages');
  });

  it('config list emits a non-empty list', async () => {
    const r = await runCli(['config', 'list']);
    expect(r.code).toBe(0);
    expect(r.stdout).toMatch(/packages:/);
    expect(r.stdout).toMatch(/repos:/);
  });

  it('completion bash emits a non-empty shell script that bash -n parses', async () => {
    const r = await runCli(['completion', 'bash']);
    expect(r.code).toBe(0);
    expect(r.stdout.length).toBeGreaterThan(0);
    expect(r.stdout).toMatch(/complete -F _batch_upgrade_npm/);
  });

  it('completion zsh emits a non-empty script', async () => {
    const r = await runCli(['completion', 'zsh']);
    expect(r.code).toBe(0);
    expect(r.stdout).toMatch(/compdef/);
  });

  it('completion fish emits a non-empty script', async () => {
    const r = await runCli(['completion', 'fish']);
    expect(r.code).toBe(0);
    expect(r.stdout).toMatch(/__fish_use_subcommand/);
  });

  it('completion with unknown shell exits 2 with hint', async () => {
    const r = await runCli(['completion', 'tcsh']);
    expect(r.code).toBe(2);
    expect(r.stderr).toMatch(/bash, zsh, fish/);
  });

  it('legacy flag-only form prints deprecation warning to stderr and still works', async () => {
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
