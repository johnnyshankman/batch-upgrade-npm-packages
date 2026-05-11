import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  {
    extends: './vitest.config.ts',
    test: {
      name: 'unit',
      include: ['__tests__/*.test.ts'],
    },
  },
  {
    extends: './vitest.config.ts',
    test: {
      name: 'integration',
      include: ['__tests__/integration/**/*.test.ts'],
      testTimeout: 30_000,
      pool: 'forks',
      poolOptions: { forks: { singleFork: true } },
    },
  },
]);
