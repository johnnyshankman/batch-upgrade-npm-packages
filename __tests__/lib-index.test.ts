import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  packageExists,
  getCurrentVersion,
  versionIsHigherOrEqual,
  updatePackageJson,
} from '../lib/index.js';

interface Tmp {
  dir: string;
  file: string;
  cleanup(): void;
}

function tmpPackageJson(contents: unknown): Tmp {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bu-lib-test-'));
  const file = path.join(dir, 'package.json');
  fs.writeFileSync(
    file,
    typeof contents === 'string' ? contents : JSON.stringify(contents, null, 2)
  );
  return { dir, file, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

describe('packageExists', () => {
  it('returns false when package.json does not exist', () => {
    expect(packageExists('any', '/nonexistent/path/package.json')).toBe(false);
  });

  it('detects packages in dependencies', () => {
    const t = tmpPackageJson({ dependencies: { react: '^17.0.0' } });
    try {
      expect(packageExists('react', t.file)).toBeTruthy();
    } finally {
      t.cleanup();
    }
  });

  it('detects packages in devDependencies', () => {
    const t = tmpPackageJson({ devDependencies: { jest: '^29.0.0' } });
    try {
      expect(packageExists('jest', t.file)).toBeTruthy();
    } finally {
      t.cleanup();
    }
  });

  it('detects packages in peerDependencies', () => {
    const t = tmpPackageJson({ peerDependencies: { react: '^17.0.0' } });
    try {
      expect(packageExists('react', t.file)).toBeTruthy();
    } finally {
      t.cleanup();
    }
  });

  it('returns false when package is absent', () => {
    const t = tmpPackageJson({ dependencies: { vue: '^3.0.0' } });
    try {
      expect(packageExists('react', t.file)).toBeFalsy();
    } finally {
      t.cleanup();
    }
  });

  it('returns false on malformed JSON', () => {
    const t = tmpPackageJson('not json');
    try {
      expect(packageExists('react', t.file)).toBe(false);
    } finally {
      t.cleanup();
    }
  });
});

describe('getCurrentVersion', () => {
  it('returns null when package.json does not exist', () => {
    expect(getCurrentVersion('any', '/nonexistent/path/package.json')).toBe(null);
  });

  it('returns the section and version for a package in dependencies', () => {
    const t = tmpPackageJson({ dependencies: { react: '^17.0.0' } });
    try {
      expect(getCurrentVersion('react', t.file)).toEqual({
        section: 'dependencies',
        version: '^17.0.0',
      });
    } finally {
      t.cleanup();
    }
  });

  it('returns devDependencies when only in devDependencies', () => {
    const t = tmpPackageJson({ devDependencies: { jest: '^29.0.0' } });
    try {
      expect(getCurrentVersion('jest', t.file)).toEqual({
        section: 'devDependencies',
        version: '^29.0.0',
      });
    } finally {
      t.cleanup();
    }
  });

  it('prioritizes dependencies over devDependencies', () => {
    const t = tmpPackageJson({
      dependencies: { react: '^17.0.0' },
      devDependencies: { react: '^18.0.0' },
    });
    try {
      expect(getCurrentVersion('react', t.file)).toEqual({
        section: 'dependencies',
        version: '^17.0.0',
      });
    } finally {
      t.cleanup();
    }
  });

  it('returns null when package is absent', () => {
    const t = tmpPackageJson({ dependencies: { vue: '^3.0.0' } });
    try {
      expect(getCurrentVersion('react', t.file)).toBe(null);
    } finally {
      t.cleanup();
    }
  });
});

describe('versionIsHigherOrEqual', () => {
  it.each([
    ['^1.2.0', '^1.1.0', true],
    ['~1.1.0', '~1.2.0', false],
    ['1.0.0', '1.0.0', true],
    ['=2.0.0', '1.9.9', true],
    ['^17.0.0', '^18.0.0', false],
  ] as const)('versionIsHigherOrEqual(%s, %s) → %s', (a, b, expected) => {
    expect(versionIsHigherOrEqual(a, b)).toBe(expected);
  });
});

describe('updatePackageJson', () => {
  it('updates an existing package version and returns true', () => {
    const t = tmpPackageJson({ dependencies: { react: '^17.0.0' } });
    try {
      const result = updatePackageJson('react', 'dependencies', '^18.0.0', t.file);
      expect(result).toBe(true);
      const after = JSON.parse(fs.readFileSync(t.file, 'utf8')) as {
        dependencies: { react: string };
      };
      expect(after.dependencies.react).toBe('^18.0.0');
    } finally {
      t.cleanup();
    }
  });

  it('returns false when package is missing from the section', () => {
    const t = tmpPackageJson({ dependencies: { vue: '^3.0.0' } });
    try {
      expect(updatePackageJson('react', 'dependencies', '^18.0.0', t.file)).toBe(false);
    } finally {
      t.cleanup();
    }
  });

  it('returns false when the section is missing', () => {
    const t = tmpPackageJson({ dependencies: { react: '^17.0.0' } });
    try {
      expect(updatePackageJson('react', 'devDependencies', '^18.0.0', t.file)).toBe(false);
    } finally {
      t.cleanup();
    }
  });

  it('preserves trailing newline on write', () => {
    const t = tmpPackageJson({ dependencies: { react: '^17.0.0' } });
    try {
      updatePackageJson('react', 'dependencies', '^18.0.0', t.file);
      const raw = fs.readFileSync(t.file, 'utf8');
      expect(raw.endsWith('\n')).toBe(true);
    } finally {
      t.cleanup();
    }
  });
});
