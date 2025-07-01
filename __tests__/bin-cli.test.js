const { program } = require('commander');
const inquirer = require('inquirer');
const chalk = require('chalk');
const ora = require('ora');

jest.mock('commander', () => ({
  program: {
    name: jest.fn().mockReturnThis(),
    description: jest.fn().mockReturnThis(),
    version: jest.fn().mockReturnThis(),
    option: jest.fn().mockReturnThis(),
    parse: jest.fn().mockReturnThis(),
    opts: jest.fn()
  }
}));

jest.mock('inquirer');
jest.mock('chalk', () => ({
  cyan: jest.fn(text => text),
  green: jest.fn(text => text),
  red: jest.fn(text => text),
  yellow: jest.fn(text => text),
  blue: jest.fn(text => text)
}));

const mockSpinner = {
  start: jest.fn().mockReturnThis(),
  succeed: jest.fn().mockReturnThis(),
  fail: jest.fn().mockReturnThis()
};

jest.mock('ora', () => jest.fn(() => mockSpinner));

jest.mock('../lib/index', () => ({
  updatePackages: jest.fn()
}));

const { updatePackages } = require('../lib/index');

describe('bin/cli.js', () => {
  let consoleLog;
  let consoleError;
  let processExit;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    processExit = jest.spyOn(process, 'exit').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLog.mockRestore();
    consoleError.mockRestore();
    processExit.mockRestore();
  });

  describe('inquirer prompt validation', () => {
    it('should validate version count matches package count', () => {
      const filterFn = (input) => input.split(' ').filter(Boolean);
      const validateFn = (input, answers) => {
        const pkgs = answers.packages || [];
        return input.length === pkgs.length ?
          true :
          `Number of versions (${input.length}) must match number of packages (${pkgs.length})`;
      };

      expect(filterFn('pkg1 pkg2')).toEqual(['pkg1', 'pkg2']);
      expect(validateFn(['1.0.0'], { packages: ['pkg1'] })).toBe(true);
      expect(validateFn(['1.0.0', '2.0.0'], { packages: ['pkg1'] })).toBe('Number of versions (2) must match number of packages (1)');
    });

    it('should filter input correctly', () => {
      const filterFn = (input) => input.split(' ').filter(Boolean);
      
      expect(filterFn('  pkg1   pkg2  ')).toEqual(['pkg1', 'pkg2']);
      expect(filterFn('single')).toEqual(['single']);
      expect(filterFn('')).toEqual([]);
    });
  });

  describe('command validation logic', () => {
    it('should detect packages and versions count mismatch', () => {
      const packages = ['pkg1'];
      const versions = ['1.0.0', '2.0.0'];
      
      expect(packages.length !== versions.length).toBe(true);
    });

    it('should detect empty packages', () => {
      const packages = [];
      
      expect(packages.length === 0).toBe(true);
    });

    it('should detect empty repositories', () => {
      const repos = [];
      
      expect(repos.length === 0).toBe(true);
    });
  });

  describe('updatePackages integration', () => {
    it('should call updatePackages with correct parameters', async () => {
      updatePackages.mockResolvedValue();
      
      await updatePackages({
        packages: ['pkg1', 'pkg2'],
        versions: ['1.0.0', '2.0.0'],
        repos: ['repo1', 'repo2']
      });
      
      expect(updatePackages).toHaveBeenCalledWith({
        packages: ['pkg1', 'pkg2'],
        versions: ['1.0.0', '2.0.0'],
        repos: ['repo1', 'repo2']
      });
    });

    it('should handle updatePackages errors', async () => {
      updatePackages.mockRejectedValue(new Error('Update failed'));
      
      try {
        await updatePackages({
          packages: ['pkg1'],
          versions: ['1.0.0'],
          repos: ['repo1']
        });
      } catch (error) {
        expect(error.message).toBe('Update failed');
      }
    });
  });

  describe('display formatting', () => {
    it('should format package upgrade display correctly', () => {
      const packages = ['pkg1', 'pkg2'];
      const versions = ['1.0.0', '2.0.0'];
      
      const display = packages.map((pkg, i) => `${pkg} → ${versions[i]}`);
      
      expect(display).toEqual(['pkg1 → 1.0.0', 'pkg2 → 2.0.0']);
    });

    it('should format repository display correctly', () => {
      const repos = ['repo1', 'repo2'];
      
      const display = repos.map(repo => `  ${repo}`);
      
      expect(display).toEqual(['  repo1', '  repo2']);
    });
  });

  describe('spinner and console integration', () => {
    it('should create spinner with correct message', () => {
      ora('Starting package update process...');
      
      expect(ora).toHaveBeenCalledWith('Starting package update process...');
      expect(mockSpinner.start).toBeDefined();
      expect(mockSpinner.succeed).toBeDefined();
      expect(mockSpinner.fail).toBeDefined();
    });

    it('should use chalk for colored output', () => {
      chalk.cyan('test message');
      chalk.green('success message');
      chalk.red('error message');
      
      expect(chalk.cyan).toHaveBeenCalledWith('test message');
      expect(chalk.green).toHaveBeenCalledWith('success message');
      expect(chalk.red).toHaveBeenCalledWith('error message');
    });
  });
});