const { runCmd } = require('./runCmd');
const log = require('./log');
const { CODES, CliError } = require('./exit-codes');

async function detectBaseBranch(repoPath, override) {
  if (override) return override;

  const symbolic = await runCmd('git', ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'], {
    cwd: repoPath,
  });
  if (symbolic.success) {
    const branch = symbolic.stdout.trim().replace(/^origin\//, '');
    if (branch) {
      log.debug(`detected base branch '${branch}' in ${repoPath}`);
      return branch;
    }
  }

  for (const candidate of ['main', 'master']) {
    const exists = await runCmd(
      'git',
      ['show-ref', '--verify', '--quiet', `refs/heads/${candidate}`],
      { cwd: repoPath }
    );
    if (exists.success) {
      log.debug(`fallback base branch '${candidate}' in ${repoPath}`);
      return candidate;
    }
  }

  throw new CliError(
    `Could not detect base branch in ${repoPath}`,
    CODES.NOT_FOUND,
    'pass --base <branch> (e.g. --base develop)'
  );
}

module.exports = { detectBaseBranch };
