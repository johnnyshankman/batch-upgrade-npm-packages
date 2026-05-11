import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';

import { detectBaseBranch } from '../lib/detectBaseBranch.js';
import { CliError, CODES } from '../lib/exit-codes.js';

function sh(cmd: string, cwd: string): string {
  return execSync(cmd, { cwd, stdio: 'pipe' }).toString();
}

interface RepoFixture {
  dir: string;
  cleanup(): void;
}

function makeBareRemoteRepo({ branch = 'main' }: { branch?: string } = {}): RepoFixture {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bu-bbb-'));
  const repoDir = path.join(root, 'repo');
  const remoteDir = path.join(root, 'remote.git');
  fs.mkdirSync(repoDir);
  fs.mkdirSync(remoteDir);
  sh('git init -q --bare', remoteDir);
  sh('git init -q', repoDir);
  sh(`git checkout -q -b ${branch}`, repoDir);
  sh('git config user.email t@t', repoDir);
  sh('git config user.name t', repoDir);
  sh('git config commit.gpgsign false', repoDir);
  fs.writeFileSync(path.join(repoDir, 'a'), 'x');
  sh('git add .', repoDir);
  sh('git commit -q -m init', repoDir);
  sh(`git remote add origin "${remoteDir}"`, repoDir);
  sh(`git push -q -u origin ${branch}`, repoDir);
  sh(`git remote set-head origin ${branch}`, repoDir);
  return { dir: repoDir, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}

describe('detectBaseBranch', () => {
  it('returns the override when one is provided', async () => {
    expect(await detectBaseBranch('/nonexistent', 'develop')).toBe('develop');
  });

  it('reads origin/HEAD via symbolic-ref when present', async () => {
    const fixture = makeBareRemoteRepo({ branch: 'main' });
    try {
      expect(await detectBaseBranch(fixture.dir)).toBe('main');
    } finally {
      fixture.cleanup();
    }
  });

  it('detects master in a repo with origin/HEAD pointing at master', async () => {
    const fixture = makeBareRemoteRepo({ branch: 'master' });
    try {
      expect(await detectBaseBranch(fixture.dir)).toBe('master');
    } finally {
      fixture.cleanup();
    }
  });

  it('falls back to local main/master when origin/HEAD is unavailable', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bu-bbb-noremote-'));
    const repoDir = path.join(root, 'repo');
    fs.mkdirSync(repoDir);
    sh('git init -q', repoDir);
    sh('git checkout -q -b master', repoDir);
    sh('git config user.email t@t', repoDir);
    sh('git config user.name t', repoDir);
    sh('git config commit.gpgsign false', repoDir);
    fs.writeFileSync(path.join(repoDir, 'a'), 'x');
    sh('git add .', repoDir);
    sh('git commit -q -m init', repoDir);
    try {
      expect(await detectBaseBranch(repoDir)).toBe('master');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('throws CliError with NOT_FOUND when no candidate exists', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bu-bbb-empty-'));
    const repoDir = path.join(root, 'repo');
    fs.mkdirSync(repoDir);
    sh('git init -q', repoDir);
    sh('git checkout -q -b develop', repoDir);
    sh('git config user.email t@t', repoDir);
    sh('git config user.name t', repoDir);
    sh('git config commit.gpgsign false', repoDir);
    fs.writeFileSync(path.join(repoDir, 'a'), 'x');
    sh('git add .', repoDir);
    sh('git commit -q -m init', repoDir);
    try {
      await expect(detectBaseBranch(repoDir)).rejects.toThrow(CliError);
      try {
        await detectBaseBranch(repoDir);
      } catch (err) {
        expect(err).toBeInstanceOf(CliError);
        if (err instanceof CliError) {
          expect(err.code).toBe(CODES.NOT_FOUND);
          expect(err.hint).toMatch(/--base/);
        }
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
