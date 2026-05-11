module.exports = {
  projects: [
    {
      displayName: 'unit',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/__tests__/*.test.js'],
      clearMocks: true,
      resetMocks: true,
      restoreMocks: true,
    },
    {
      displayName: 'integration',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/__tests__/integration/**/*.test.js'],
      testTimeout: 30000,
      maxWorkers: 1,
    },
  ],
  collectCoverageFrom: ['lib/**/*.js', 'bin/**/*.js', '!**/node_modules/**'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
};
