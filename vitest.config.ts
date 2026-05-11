import { defineConfig } from 'vitest/config';

// Coverage is collected via `c8 vitest run` (see `test:coverage` script and `.c8rc.json`).
// c8 propagates NODE_V8_COVERAGE to the spawned tsx subprocess used by integration
// tests, so coverage for `bin/cli.ts` and `lib/commands/*.ts` is accurate — which
// vitest's in-process inspector-based coverage provider would miss.
export default defineConfig({
  test: {
    environment: 'node',
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,
  },
});
