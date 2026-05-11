const { runCli } = require('./helpers/runCli');

// Snapshot tests for the CLI's user-visible surface (--help, --version structure).
// Intentional changes require `npm test -- -u` to update.

describe('CLI snapshots', () => {
  it('--help output is stable', async () => {
    const r = await runCli(['--help']);
    expect(r.code).toBe(0);
    expect(r.stdout).toMatchSnapshot();
  });

  it('--version output shape is stable (semver line)', async () => {
    const r = await runCli(['--version']);
    expect(r.code).toBe(0);
    expect(r.stdout).toMatch(/^\d+\.\d+\.\d+\s*$/);
  });
});
