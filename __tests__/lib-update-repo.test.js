const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { updateRepo } = require('../lib/index');
const { EventEmitter } = require('events');

jest.mock('fs');
jest.mock('child_process');
jest.mock('path');

describe('updateRepo function', () => {
  let mockSpawn;
  let originalChdir;
  let originalCwd;

  beforeEach(() => {
    jest.clearAllMocks();
    console.log = jest.fn();
    console.error = jest.fn();
    
    originalChdir = process.chdir;
    originalCwd = process.cwd;
    process.chdir = jest.fn();
    process.cwd = jest.fn(() => '/original/dir');

    mockSpawn = jest.fn();
    spawn.mockImplementation(mockSpawn);
    path.resolve.mockImplementation((p) => `/resolved/${p}`);
  });

  afterEach(() => {
    process.chdir = originalChdir;
    process.cwd = originalCwd;
  });

  const createMockProcess = (exitCode = 0, stdout = '', stderr = '') => {
    const mockProcess = new EventEmitter();
    mockProcess.stdout = new EventEmitter();
    mockProcess.stderr = new EventEmitter();
    
    setImmediate(() => {
      if (stdout) mockProcess.stdout.emit('data', Buffer.from(stdout));
      if (stderr) mockProcess.stderr.emit('data', Buffer.from(stderr));
      mockProcess.emit('close', exitCode);
    });
    
    return mockProcess;
  };

  describe('git operations', () => {
    it('should handle git checkout failure', async () => {
      let callCount = 0;
      mockSpawn.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return createMockProcess(0); // git reset
        if (callCount === 2) return createMockProcess(1, '', 'git error'); // git checkout main (fails)
        return createMockProcess(0);
      });
      
      const result = await updateRepo({
        repoPath: 'test-repo',
        packages: ['pkg1'],
        versions: ['1.0.0'],
        branchName: 'test-branch',
        prTitle: 'Test PR',
        prBody: 'Test body'
      });
      
      expect(result).toBe(false);
      expect(process.chdir).toHaveBeenCalledWith('/resolved/test-repo');
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Could not switch to main branch'));
      expect(process.chdir).toHaveBeenCalledWith('/original/dir');
    }, 10000);

    it('should handle git pull failure', async () => {
      let callCount = 0;
      mockSpawn.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return createMockProcess(0); // git reset
        if (callCount === 2) return createMockProcess(0); // git checkout main
        if (callCount === 3) return createMockProcess(1); // git pull (fails)
        return createMockProcess(0);
      });
      
      const result = await updateRepo({
        repoPath: 'test-repo',
        packages: ['pkg1'],
        versions: ['1.0.0'],
        branchName: 'test-branch',
        prTitle: 'Test PR',
        prBody: 'Test body'
      });
      
      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Could not pull latest changes'));
    }, 10000);

    it('should handle branch creation failure', async () => {
      let callCount = 0;
      mockSpawn.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return createMockProcess(0); // git reset
        if (callCount === 2) return createMockProcess(0); // git checkout main
        if (callCount === 3) return createMockProcess(0); // git pull
        if (callCount === 4) return createMockProcess(1); // git checkout -b (fails)
        return createMockProcess(0);
      });
      
      const result = await updateRepo({
        repoPath: 'test-repo',
        packages: ['pkg1'],
        versions: ['1.0.0'],
        branchName: 'test-branch',
        prTitle: 'Test PR',
        prBody: 'Test body'
      });
      
      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Could not create new branch'));
    }, 10000);
  });

  describe('package.json processing', () => {
    beforeEach(() => {
      let callCount = 0;
      mockSpawn.mockImplementation(() => {
        callCount++;
        if (callCount <= 4) return createMockProcess(0); // Initial git operations
        if (callCount === 5) return createMockProcess(0, 'changes'); // git diff
        return createMockProcess(0);
      });
    });

    it('should skip packages not found in package.json', async () => {
      fs.existsSync.mockImplementation((file) => {
        if (file === 'package.json') return true;
        return false;
      });
      
      fs.readFileSync.mockReturnValue(JSON.stringify({
        dependencies: { 'other-pkg': '^1.0.0' }
      }));
      
      fs.copyFileSync.mockImplementation(() => {});
      fs.unlinkSync.mockImplementation(() => {});
      
      const result = await updateRepo({
        repoPath: 'test-repo',
        packages: ['missing-pkg'],
        versions: ['1.0.0'],
        branchName: 'test-branch',
        prTitle: 'Test PR',
        prBody: 'Test body'
      });
      
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Skipping missing-pkg: Not found'));
    });

    it('should skip packages with higher or equal versions', async () => {
      fs.existsSync.mockImplementation((file) => {
        if (file === 'package.json') return true;
        return false;
      });
      
      fs.readFileSync.mockReturnValue(JSON.stringify({
        dependencies: { 'test-pkg': '^2.0.0' }
      }));
      
      fs.copyFileSync.mockImplementation(() => {});
      fs.unlinkSync.mockImplementation(() => {});
      
      const semver = require('semver');
      semver.gte = jest.fn().mockReturnValue(true);
      
      const result = await updateRepo({
        repoPath: 'test-repo',
        packages: ['test-pkg'],
        versions: ['1.0.0'],
        branchName: 'test-branch',
        prTitle: 'Test PR',
        prBody: 'Test body'
      });
      
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Current version ^2.0.0 is already >= 1.0.0'));
    });

    it('should update packages and handle npm install', async () => {
      fs.existsSync.mockImplementation((file) => {
        if (file === 'package.json') return true;
        if (file === 'node_modules') return true;
        return false;
      });
      
      let packageJsonContent = {
        dependencies: { 'test-pkg': '^1.0.0' }
      };
      
      fs.readFileSync.mockImplementation((file) => {
        if (file === 'package.json') return JSON.stringify(packageJsonContent);
        return '';
      });
      
      fs.writeFileSync.mockImplementation((file, content) => {
        if (file === 'package.json') {
          packageJsonContent = JSON.parse(content.replace(/\n$/, ''));
        }
      });
      
      fs.copyFileSync.mockImplementation(() => {});
      fs.unlinkSync.mockImplementation(() => {});
      fs.rmSync.mockImplementation(() => {});
      
      const semver = require('semver');
      semver.gte = jest.fn().mockReturnValue(false);
      
      let gitCallCount = 0;
      mockSpawn.mockImplementation((cmd, args) => {
        if (cmd === 'git') {
          gitCallCount++;
          if (gitCallCount <= 4) return createMockProcess(0);
          if (gitCallCount === 5) return createMockProcess(0, 'changes');
          return createMockProcess(0);
        }
        if (cmd === 'npm') return createMockProcess(0);
        if (cmd === 'gh') return createMockProcess(0, 'PR created');
        return createMockProcess(0);
      });
      
      const result = await updateRepo({
        repoPath: 'test-repo',
        packages: ['test-pkg'],
        versions: ['^2.0.0'],
        branchName: 'test-branch',
        prTitle: 'Test PR',
        prBody: 'Test body'
      });
      
      expect(result).toBe(true);
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Updating test-pkg from ^1.0.0 to ^2.0.0'));
      expect(fs.rmSync).toHaveBeenCalledWith('node_modules', { recursive: true, force: true });
    });

    it('should handle npm install failure', async () => {
      fs.existsSync.mockImplementation((file) => {
        if (file === 'package.json') return true;
        return false;
      });
      
      fs.readFileSync.mockReturnValue(JSON.stringify({
        dependencies: { 'test-pkg': '^1.0.0' }
      }));
      
      fs.writeFileSync.mockImplementation(() => {});
      fs.copyFileSync.mockImplementation(() => {});
      fs.unlinkSync.mockImplementation(() => {});
      
      const semver = require('semver');
      semver.gte = jest.fn().mockReturnValue(false);
      
      let gitCallCount = 0;
      mockSpawn.mockImplementation((cmd, args) => {
        if (cmd === 'git') {
          gitCallCount++;
          if (gitCallCount <= 4) return createMockProcess(0);
          return createMockProcess(0);
        }
        if (cmd === 'npm' && args.includes('--force')) return createMockProcess(1); // npm install --force fails
        return createMockProcess(0);
      });
      
      const result = await updateRepo({
        repoPath: 'test-repo',
        packages: ['test-pkg'],
        versions: ['^2.0.0'],
        branchName: 'test-branch',
        prTitle: 'Test PR',
        prBody: 'Test body'
      });
      
      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Force installation failed'));
    });
  });

  describe('PR creation', () => {
    beforeEach(() => {
      fs.existsSync.mockImplementation((file) => {
        if (file === 'package.json') return true;
        return false;
      });
      
      fs.readFileSync.mockReturnValue(JSON.stringify({
        dependencies: { 'test-pkg': '^1.0.0' }
      }));
      
      fs.writeFileSync.mockImplementation(() => {});
      fs.copyFileSync.mockImplementation(() => {});
      fs.unlinkSync.mockImplementation(() => {});
      
      const semver = require('semver');
      semver.gte = jest.fn().mockReturnValue(false);
    });

    it('should create PR when changes are detected', async () => {
      let gitCallCount = 0;
      mockSpawn.mockImplementation((cmd, args) => {
        if (cmd === 'git') {
          gitCallCount++;
          if (gitCallCount <= 4) return createMockProcess(0);
          if (gitCallCount === 5) return createMockProcess(0, 'changes');
          return createMockProcess(0);
        }
        if (cmd === 'npm') return createMockProcess(0);
        if (cmd === 'gh') return createMockProcess(0, 'PR created successfully');
        return createMockProcess(0);
      });
      
      const result = await updateRepo({
        repoPath: 'test-repo',
        packages: ['test-pkg'],
        versions: ['^2.0.0'],
        branchName: 'test-branch',
        prTitle: 'Test PR',
        prBody: 'Test body'
      });
      
      expect(result).toBe(true);
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Pull request created successfully'));
    });

    it('should skip PR creation when no changes detected', async () => {
      let gitCallCount = 0;
      mockSpawn.mockImplementation((cmd, args) => {
        if (cmd === 'git') {
          gitCallCount++;
          if (gitCallCount <= 4) return createMockProcess(0);
          if (gitCallCount === 5) return createMockProcess(0, ''); // No changes
          return createMockProcess(0);
        }
        return createMockProcess(0);
      });
      
      const result = await updateRepo({
        repoPath: 'test-repo',
        packages: ['missing-pkg'],
        versions: ['^2.0.0'],
        branchName: 'test-branch',
        prTitle: 'Test PR',
        prBody: 'Test body'
      });
      
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('No changes detected'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Skipping PR creation'));
    });

    it('should handle PR creation failure', async () => {
      let gitCallCount = 0;
      mockSpawn.mockImplementation((cmd, args) => {
        if (cmd === 'git') {
          gitCallCount++;
          if (gitCallCount <= 4) return createMockProcess(0);
          if (gitCallCount === 5) return createMockProcess(0, 'changes');
          return createMockProcess(0);
        }
        if (cmd === 'npm') return createMockProcess(0);
        if (cmd === 'gh') return createMockProcess(1, '', 'PR creation failed');
        return createMockProcess(0);
      });
      
      const result = await updateRepo({
        repoPath: 'test-repo',
        packages: ['test-pkg'],
        versions: ['^2.0.0'],
        branchName: 'test-branch',
        prTitle: 'Test PR',
        prBody: 'Test body'
      });
      
      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Could not create PR'));
    });
  });

  describe('error handling', () => {
    it('should handle unexpected errors and restore working directory', async () => {
      mockSpawn.mockImplementation(() => {
        throw new Error('Unexpected error');
      });
      
      const result = await updateRepo({
        repoPath: 'test-repo',
        packages: ['test-pkg'],
        versions: ['^2.0.0'],
        branchName: 'test-branch',
        prTitle: 'Test PR',
        prBody: 'Test body'
      });
      
      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Error processing repository'));
      expect(process.chdir).toHaveBeenCalledWith('/original/dir');
    });
  });
});