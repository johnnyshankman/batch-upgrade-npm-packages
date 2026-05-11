import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';

function sh(cmd: string, cwd: string): string {
  return execSync(cmd, { cwd, stdio: 'pipe' }).toString();
}

export interface MakeRepoOptions {
  packageJson?: Record<string, unknown>;
  branch?: string;
  dirty?: boolean;
  withBareRemote?: boolean;
  extraFiles?: Record<string, string>;
}

export interface RepoFixture {
  root: string;
  dir: string;
  remoteDir: string | null;
  branch: string;
  headSha: string;
  cleanup(): void;
  headNow(): string;
  status(): string;
  readPackageJson(): { dependencies?: Record<string, string>; [k: string]: unknown };
}

export function makeRepo({
  packageJson = { name: 'fixture', version: '1.0.0', dependencies: { react: '^17.0.0' } },
  branch = 'main',
  dirty = false,
  withBareRemote = true,
  extraFiles = {},
}: MakeRepoOptions = {}): RepoFixture {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bu-fixture-'));
  const repoDir = path.join(root, 'repo');
  const remoteDir = path.join(root, 'remote.git');
  fs.mkdirSync(repoDir);

  sh('git init -q', repoDir);
  sh(`git checkout -q -b ${branch}`, repoDir);
  sh('git config user.email test@test', repoDir);
  sh('git config user.name test', repoDir);
  sh('git config commit.gpgsign false', repoDir);

  fs.writeFileSync(path.join(repoDir, 'package.json'), JSON.stringify(packageJson, null, 2) + '\n');
  fs.writeFileSync(
    path.join(repoDir, 'package-lock.json'),
    JSON.stringify(
      {
        name: (packageJson['name'] as string) ?? 'fixture',
        version: (packageJson['version'] as string) ?? '1.0.0',
        lockfileVersion: 2,
      },
      null,
      2
    ) + '\n'
  );
  for (const [name, content] of Object.entries(extraFiles)) {
    const full = path.join(repoDir, name);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  sh('git add .', repoDir);
  sh('git commit -q -m initial', repoDir);

  if (withBareRemote) {
    fs.mkdirSync(remoteDir);
    sh('git init -q --bare', remoteDir);
    sh(`git remote add origin "${remoteDir}"`, repoDir);
    sh(`git push -q -u origin ${branch}`, repoDir);
  }

  if (dirty) {
    fs.writeFileSync(path.join(repoDir, 'dirty.txt'), 'uncommitted content\n');
  }

  const headSha = sh('git rev-parse HEAD', repoDir).trim();

  return {
    root,
    dir: repoDir,
    remoteDir: withBareRemote ? remoteDir : null,
    branch,
    headSha,
    cleanup(): void {
      fs.rmSync(root, { recursive: true, force: true });
    },
    headNow(): string {
      return sh('git rev-parse HEAD', repoDir).trim();
    },
    status(): string {
      return sh('git status --porcelain', repoDir);
    },
    readPackageJson(): { dependencies?: Record<string, string>; [k: string]: unknown } {
      return JSON.parse(fs.readFileSync(path.join(repoDir, 'package.json'), 'utf8')) as {
        dependencies?: Record<string, string>;
        [k: string]: unknown;
      };
    },
  };
}
