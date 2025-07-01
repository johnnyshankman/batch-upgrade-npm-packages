const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const semver = require('semver');

const {
  updatePackages,
  checkGhLogin,
  packageExists,
  getCurrentVersion,
  versionIsHigherOrEqual,
  updatePackageJson,
  updateRepo
} = require('../lib/index');

jest.mock('fs');
jest.mock('child_process');
jest.mock('semver');

describe('lib/index.js', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    console.log = jest.fn();
    console.error = jest.fn();
    process.chdir = jest.fn();
    process.cwd = jest.fn(() => '/test/original/dir');
  });

  describe('checkGhLogin', () => {
    it('should return true when gh auth status succeeds', () => {
      execSync.mockReturnValue('');
      
      const result = checkGhLogin();
      
      expect(result).toBe(true);
      expect(execSync).toHaveBeenCalledWith('gh auth status', { stdio: 'ignore' });
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('GitHub CLI authentication confirmed'));
    });

    it('should return false when gh auth status fails', () => {
      execSync.mockImplementation(() => {
        throw new Error('not logged in');
      });
      
      const result = checkGhLogin();
      
      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('not logged into GitHub CLI'));
    });
  });

  describe('packageExists', () => {
    it('should return false when package.json does not exist', () => {
      fs.existsSync.mockReturnValue(false);
      
      const result = packageExists('test-package');
      
      expect(result).toBe(false);
      expect(fs.existsSync).toHaveBeenCalledWith('package.json');
    });

    it('should return true when package exists in dependencies', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify({
        dependencies: { 'test-package': '^1.0.0' }
      }));
      
      const result = packageExists('test-package');
      
      expect(result).toBeTruthy();
    });

    it('should return true when package exists in devDependencies', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify({
        devDependencies: { 'test-package': '^1.0.0' }
      }));
      
      const result = packageExists('test-package');
      
      expect(result).toBeTruthy();
    });

    it('should return true when package exists in peerDependencies', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify({
        peerDependencies: { 'test-package': '^1.0.0' }
      }));
      
      const result = packageExists('test-package');
      
      expect(result).toBeTruthy();
    });

    it('should return false when package does not exist in any dependencies', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify({
        dependencies: { 'other-package': '^1.0.0' }
      }));
      
      const result = packageExists('test-package');
      
      expect(result).toBeFalsy();
    });

    it('should handle JSON parse errors', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('invalid json');
      
      const result = packageExists('test-package');
      
      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Error checking if package'));
    });
  });

  describe('getCurrentVersion', () => {
    it('should return null when package.json does not exist', () => {
      fs.existsSync.mockReturnValue(false);
      
      const result = getCurrentVersion('test-package');
      
      expect(result).toBe(null);
    });

    it('should return version info when package exists in dependencies', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify({
        dependencies: { 'test-package': '^1.0.0' }
      }));
      
      const result = getCurrentVersion('test-package');
      
      expect(result).toEqual({
        section: 'dependencies',
        version: '^1.0.0'
      });
    });

    it('should return version info when package exists in devDependencies', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify({
        devDependencies: { 'test-package': '^1.0.0' }
      }));
      
      const result = getCurrentVersion('test-package');
      
      expect(result).toEqual({
        section: 'devDependencies',
        version: '^1.0.0'
      });
    });

    it('should prioritize dependencies over devDependencies', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify({
        dependencies: { 'test-package': '^1.0.0' },
        devDependencies: { 'test-package': '^2.0.0' }
      }));
      
      const result = getCurrentVersion('test-package');
      
      expect(result).toEqual({
        section: 'dependencies',
        version: '^1.0.0'
      });
    });

    it('should return null when package does not exist', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify({
        dependencies: { 'other-package': '^1.0.0' }
      }));
      
      const result = getCurrentVersion('test-package');
      
      expect(result).toBe(null);
    });

    it('should handle JSON parse errors', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('invalid json');
      
      const result = getCurrentVersion('test-package');
      
      expect(result).toBe(null);
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Error getting current version'));
    });
  });

  describe('versionIsHigherOrEqual', () => {
    beforeEach(() => {
      semver.gte.mockImplementation((a, b) => a >= b);
    });

    it('should clean version prefixes and compare', () => {
      semver.gte.mockReturnValue(true);
      
      const result = versionIsHigherOrEqual('^1.2.0', '~1.1.0');
      
      expect(semver.gte).toHaveBeenCalledWith('1.2.0', '1.1.0');
      expect(result).toBe(true);
    });

    it('should handle versions without prefixes', () => {
      semver.gte.mockReturnValue(false);
      
      const result = versionIsHigherOrEqual('1.0.0', '1.1.0');
      
      expect(semver.gte).toHaveBeenCalledWith('1.0.0', '1.1.0');
      expect(result).toBe(false);
    });

    it('should clean caret prefix', () => {
      semver.gte.mockReturnValue(true);
      
      versionIsHigherOrEqual('^1.0.0', '^1.0.0');
      
      expect(semver.gte).toHaveBeenCalledWith('1.0.0', '1.0.0');
    });

    it('should clean tilde prefix', () => {
      semver.gte.mockReturnValue(true);
      
      versionIsHigherOrEqual('~1.0.0', '~1.0.0');
      
      expect(semver.gte).toHaveBeenCalledWith('1.0.0', '1.0.0');
    });

    it('should clean equals prefix', () => {
      semver.gte.mockReturnValue(true);
      
      versionIsHigherOrEqual('=1.0.0', '=1.0.0');
      
      expect(semver.gte).toHaveBeenCalledWith('1.0.0', '1.0.0');
    });
  });

  describe('updatePackageJson', () => {
    it('should update package version successfully', () => {
      const packageJson = {
        dependencies: { 'test-package': '^1.0.0' }
      };
      fs.readFileSync.mockReturnValue(JSON.stringify(packageJson));
      fs.writeFileSync.mockImplementation(() => {});
      
      const result = updatePackageJson('test-package', 'dependencies', '^2.0.0');
      
      expect(result).toBe(true);
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        'package.json',
        JSON.stringify({
          dependencies: { 'test-package': '^2.0.0' }
        }, null, 2) + '\n'
      );
    });

    it('should return false when package does not exist in specified section', () => {
      const packageJson = {
        dependencies: { 'other-package': '^1.0.0' }
      };
      fs.readFileSync.mockReturnValue(JSON.stringify(packageJson));
      
      const result = updatePackageJson('test-package', 'dependencies', '^2.0.0');
      
      expect(result).toBe(false);
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it('should return false when section does not exist', () => {
      const packageJson = {
        dependencies: { 'test-package': '^1.0.0' }
      };
      fs.readFileSync.mockReturnValue(JSON.stringify(packageJson));
      
      const result = updatePackageJson('test-package', 'devDependencies', '^2.0.0');
      
      expect(result).toBe(false);
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it('should handle file read errors', () => {
      fs.readFileSync.mockImplementation(() => {
        throw new Error('file read error');
      });
      
      const result = updatePackageJson('test-package', 'dependencies', '^2.0.0');
      
      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Error updating package.json'));
    });

    it('should handle file write errors', () => {
      const packageJson = {
        dependencies: { 'test-package': '^1.0.0' }
      };
      fs.readFileSync.mockReturnValue(JSON.stringify(packageJson));
      fs.writeFileSync.mockImplementation(() => {
        throw new Error('file write error');
      });
      
      const result = updatePackageJson('test-package', 'dependencies', '^2.0.0');
      
      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Error updating package.json'));
    });
  });

  describe('updatePackages', () => {
    beforeEach(() => {
      execSync.mockReturnValue('');
    });

    it('should return false when gh auth fails', async () => {
      execSync.mockImplementation(() => {
        throw new Error('not logged in');
      });
      
      const result = await updatePackages({
        packages: ['test-pkg'],
        versions: ['^1.0.0'],
        repos: ['test-repo']
      });
      
      expect(result).toBe(false);
    });

    it('should return false when packages and versions length mismatch', async () => {
      const result = await updatePackages({
        packages: ['test-pkg'],
        versions: ['^1.0.0', '^2.0.0'],
        repos: ['test-repo']
      });
      
      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Number of packages and versions must match'));
    });

    it('should return false when no packages provided', async () => {
      const result = await updatePackages({
        packages: [],
        versions: [],
        repos: ['test-repo']
      });
      
      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('No packages specified'));
    });

    it('should return false when no repos provided', async () => {
      const result = await updatePackages({
        packages: ['test-pkg'],
        versions: ['^1.0.0'],
        repos: []
      });
      
      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('No repositories specified'));
    });
  });
});