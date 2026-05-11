const fs = require('fs');
const path = require('path');
const semver = require('semver');
const chalk = require('chalk');
const { runCmd } = require('./runCmd');
const log = require('./log');

async function checkGhLogin() {
  log.info(chalk.blue("Checking if you're logged into GitHub CLI..."));
  const r = await runCmd('gh', ['auth', 'status']);
  if (r.success) {
    log.success(chalk.green('GitHub CLI authentication confirmed.'));
    return true;
  }
  log.error(
    chalk.red("Error: You are not logged into GitHub CLI. Please run 'gh auth login' first.")
  );
  return false;
}

function packageExists(pkg, packageJsonPath = 'package.json') {
  if (!fs.existsSync(packageJsonPath)) return false;
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    return (
      (packageJson.dependencies && packageJson.dependencies[pkg]) ||
      (packageJson.devDependencies && packageJson.devDependencies[pkg]) ||
      (packageJson.peerDependencies && packageJson.peerDependencies[pkg])
    );
  } catch (error) {
    log.error(chalk.red(`Error checking if package ${pkg} exists: ${error.message}`));
    return false;
  }
}

function getCurrentVersion(pkg, packageJsonPath = 'package.json') {
  if (!fs.existsSync(packageJsonPath)) return null;
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const sections = ['dependencies', 'devDependencies', 'peerDependencies'];
    for (const section of sections) {
      if (packageJson[section] && packageJson[section][pkg]) {
        return { section, version: packageJson[section][pkg] };
      }
    }
    return null;
  } catch (error) {
    log.error(chalk.red(`Error getting current version for ${pkg}: ${error.message}`));
    return null;
  }
}

function versionIsHigherOrEqual(current, target) {
  const cleanCurrent = current.replace(/^[\^~=]/, '');
  const cleanTarget = target.replace(/^[\^~=]/, '');
  return semver.gte(cleanCurrent, cleanTarget);
}

function updatePackageJson(pkg, section, version, packageJsonPath = 'package.json') {
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    if (packageJson[section] && packageJson[section][pkg] !== undefined) {
      packageJson[section][pkg] = version;
      if (log.isDryRun()) {
        log.dryRun(`Would write ${packageJsonPath}: ${pkg}@${version} in ${section}`);
        return true;
      }
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
      return true;
    }
    return false;
  } catch (error) {
    log.error(chalk.red(`Error updating package.json for ${pkg}: ${error.message}`));
    return false;
  }
}

async function checkWorkingTreeClean(repoCwd) {
  const r = await runCmd('git', ['status', '--porcelain'], { cwd: repoCwd });
  if (!r.success) {
    return { clean: false, reason: 'git-status-failed', stderr: r.stderr };
  }
  return { clean: r.stdout.trim() === '', porcelain: r.stdout };
}

async function updateRepo(options) {
  const { repoPath, packages, versions, branchName, prTitle, prBody, resetHard = false } = options;
  const repoCwd = path.resolve(repoPath);
  const packageJsonPath = path.join(repoCwd, 'package.json');

  log.info(chalk.cyan('\n-------------------------------------'));
  log.info(chalk.cyan(`Processing repository: ${repoPath}`));

  try {
    const cleanCheck = await checkWorkingTreeClean(repoCwd);
    if (!cleanCheck.clean) {
      if (cleanCheck.reason === 'git-status-failed') {
        log.error(chalk.red(`Error: Could not read git status in ${repoPath}`));
        log.error(chalk.red('  → Try: cd ' + repoPath + ' && git status'));
        const e = new Error(`Could not read git status in ${repoPath}`);
        e.code = 1;
        throw e;
      }
      if (!resetHard) {
        log.error(chalk.red(`Error: Uncommitted changes in ${repoPath}. Refusing to overwrite.`));
        log.error(
          chalk.red(
            '  → Try: commit or stash your work, OR re-run with --reset-hard (destroys uncommitted changes)'
          )
        );
        const e = new Error(`Uncommitted changes in ${repoPath}`);
        e.code = 5;
        throw e;
      }
      log.warn(chalk.yellow('Discarding uncommitted changes (--reset-hard)...'));
      const resetResult = await runCmd('git', ['reset', '--hard', 'HEAD'], {
        cwd: repoCwd,
        mutating: true,
      });
      if (!resetResult.success) {
        log.error(chalk.red(`Error: git reset --hard failed in ${repoPath}`));
        return false;
      }
    }

    log.info(chalk.blue('Switching to main branch...'));
    const mainResult = await runCmd('git', ['checkout', 'main'], {
      cwd: repoCwd,
      mutating: true,
    });
    if (!mainResult.success) {
      log.error(chalk.red(`Error: Could not switch to main branch in ${repoPath}`));
      return false;
    }

    log.info(chalk.blue('Pulling latest changes from origin/main...'));
    const pullResult = await runCmd('git', ['pull', 'origin', 'main'], {
      cwd: repoCwd,
      mutating: true,
    });
    if (!pullResult.success) {
      log.error(chalk.red(`Error: Could not pull latest changes in ${repoPath}`));
      return false;
    }

    log.info(chalk.blue(`Creating and switching to new branch: ${branchName}...`));
    const branchResult = await runCmd('git', ['checkout', '-b', branchName], {
      cwd: repoCwd,
      mutating: true,
    });
    if (!branchResult.success) {
      log.error(chalk.red(`Error: Could not create new branch in ${repoPath}`));
      return false;
    }

    log.info(chalk.blue('Checking packages:'));
    let updateSuccess = false;
    const updatedPackages = [];
    const updatedVersions = [];

    if (fs.existsSync(packageJsonPath)) {
      const backupPath = packageJsonPath + '.bak';
      if (!log.isDryRun()) {
        fs.copyFileSync(packageJsonPath, backupPath);
      }

      log.info(chalk.blue('Analyzing package versions in package.json...'));

      for (let i = 0; i < packages.length; i++) {
        const pkg = packages[i];
        const ver = versions[i];

        if (!packageExists(pkg, packageJsonPath)) {
          log.warn(chalk.yellow(`  - Skipping ${pkg}: Not found in package.json`));
          continue;
        }

        const currentVersionInfo = getCurrentVersion(pkg, packageJsonPath);
        if (!currentVersionInfo) {
          log.warn(chalk.yellow(`  - Warning: Could not determine current version of ${pkg}`));
          continue;
        }

        const { section, version: currentVersion } = currentVersionInfo;

        if (versionIsHigherOrEqual(currentVersion, ver)) {
          log.warn(
            chalk.yellow(
              `  - Skipping ${pkg}: Current version ${currentVersion} is already >= ${ver}`
            )
          );
          continue;
        }

        log.success(
          chalk.green(`  - Updating ${pkg} from ${currentVersion} to ${ver} in ${section} section`)
        );

        updatedPackages.push(pkg);
        updatedVersions.push(ver);

        const updated = updatePackageJson(pkg, section, ver, packageJsonPath);
        if (updated) {
          updateSuccess = true;
        } else {
          log.warn(chalk.yellow(`  - Warning: Could not update ${pkg} in package.json`));
        }
      }

      if (!updateSuccess) {
        if (!log.isDryRun()) {
          fs.copyFileSync(backupPath, packageJsonPath);
        }
        log.warn(chalk.yellow('No packages were updated in package.json'));
      }
      if (!log.isDryRun()) {
        fs.unlinkSync(backupPath);
      }
    }

    if (updateSuccess) {
      const nodeModulesPath = path.join(repoCwd, 'node_modules');
      if (log.isDryRun()) {
        log.dryRun(`Would remove node_modules in ${repoPath} and run npm install --force then npm install`);
      } else {
        log.info(chalk.blue('Removing node_modules directory for clean installation...'));
        try {
          if (fs.existsSync(nodeModulesPath)) {
            fs.rmSync(nodeModulesPath, { recursive: true, force: true });
          }
        } catch (err) {
          log.error(chalk.red(`Error removing node_modules: ${err.message}`));
        }

        log.info(
          chalk.blue(
            'Updating package-lock.json and verifying installation with npm install --force...'
          )
        );
        const forceInstallResult = await runCmd('npm', ['install', '--force'], {
          cwd: repoCwd,
          mutating: true,
        });
        if (!forceInstallResult.success) {
          log.error(chalk.red(`Error: Force installation failed in ${repoPath}`));
          log.error(
            chalk.red(
              '  → Try: cd ' +
                repoPath +
                ' && npm install --force  (reproduce locally to see the full error)'
            )
          );
          return false;
        }

        log.info(chalk.blue('Removing node_modules directory again before verification...'));
        try {
          if (fs.existsSync(nodeModulesPath)) {
            fs.rmSync(nodeModulesPath, { recursive: true, force: true });
          }
        } catch (err) {
          log.error(chalk.red(`Error removing node_modules: ${err.message}`));
        }

        log.info(chalk.blue('Verifying package installation with regular npm install...'));
        const regularInstallResult = await runCmd('npm', ['install'], {
          cwd: repoCwd,
          mutating: true,
        });
        if (!regularInstallResult.success) {
          log.error(
            chalk.red(`Error: Regular installation failed after forced install in ${repoPath}`)
          );
          return false;
        }

        log.success(chalk.green('Package installation verified successfully.'));
      }
    }

    let hasChanges;
    if (log.isDryRun()) {
      hasChanges = updateSuccess;
    } else {
      const diffResult = await runCmd(
        'git',
        ['diff', '--quiet', '--', 'package.json', 'package-lock.json'],
        { cwd: repoCwd }
      );
      hasChanges = diffResult.exitCode === 1;
    }

    if (hasChanges) {
      log.info(chalk.blue('Changes detected. Committing and pushing...'));

      let updatedPackageList = '';
      let updatedPrBody = 'This PR updates the following npm packages:\n\n';

      for (let i = 0; i < updatedPackages.length; i++) {
        if (i > 0) updatedPackageList += ', ';
        updatedPackageList += `${updatedPackages[i]}@${updatedVersions[i]}`;
        updatedPrBody += `- ${updatedPackages[i]} to ${updatedVersions[i]}\n`;
      }
      updatedPrBody += '\nAutomatically generated by batch-upgrade-npm-packages.';

      let finalPrTitle = prTitle;
      let finalPrBody = prBody;

      if (updatedPackageList) {
        finalPrTitle = `Update npm packages: ${updatedPackageList}`;
        finalPrBody = updatedPrBody;
      }

      await runCmd('git', ['add', 'package.json', 'package-lock.json'], {
        cwd: repoCwd,
        mutating: true,
      });
      await runCmd('git', ['commit', '-m', finalPrTitle], { cwd: repoCwd, mutating: true });

      log.info(chalk.blue('Pushing changes...'));
      const pushResult = await runCmd(
        'git',
        ['push', '--set-upstream', 'origin', branchName],
        { cwd: repoCwd, mutating: true }
      );
      if (!pushResult.success) {
        log.error(chalk.red(`Error: Could not push changes for ${repoPath}`));
        return false;
      }

      log.info(chalk.blue('Creating pull request...'));
      const prResult = await runCmd(
        'gh',
        ['pr', 'create', '--title', finalPrTitle, '--body', finalPrBody, '--base', 'main'],
        { cwd: repoCwd, mutating: true }
      );
      if (!prResult.success) {
        log.error(chalk.red(`Error: Could not create PR for ${repoPath}`));
        return false;
      }

      log.success(chalk.green(`Pull request created successfully for ${repoPath}`));
    } else {
      log.warn(
        chalk.yellow('No changes detected in package.json or package-lock.json. Skipping PR creation.')
      );
      await runCmd('git', ['checkout', 'main'], { cwd: repoCwd, mutating: true });
      await runCmd('git', ['branch', '-D', branchName], { cwd: repoCwd, mutating: true });
    }

    log.success(chalk.green(`Completed processing ${repoPath}`));
    return true;
  } catch (error) {
    if (typeof error.code === 'number') throw error;
    log.error(chalk.red(`Error processing repository ${repoPath}: ${error.message}`));
    return false;
  }
}

async function updatePackages(options) {
  const { packages, versions, repos, resetHard = false } = options;

  if (!(await checkGhLogin())) {
    const e = new Error('GitHub CLI not authenticated.');
    e.code = 3;
    throw e;
  }

  if (packages.length !== versions.length) {
    log.error(chalk.red('Error: Number of packages and versions must match.'));
    return false;
  }

  if (packages.length === 0) {
    log.error(chalk.red('Error: No packages specified.'));
    return false;
  }

  if (repos.length === 0) {
    log.error(chalk.red('Error: No repositories specified.'));
    return false;
  }

  const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);

  let packageList = '';
  for (let i = 0; i < packages.length; i++) {
    if (i > 0) packageList += ', ';
    packageList += `${packages[i]}@${versions[i]}`;
  }
  const prTitle = `Update npm packages: ${packageList}`;

  let prBody = 'This PR updates the following npm packages:\n\n';
  for (let i = 0; i < packages.length; i++) {
    prBody += `- ${packages[i]} to ${versions[i]}\n`;
  }
  prBody += '\nAutomatically generated by batch-upgrade-npm-packages.';

  const results = [];
  for (const repo of repos) {
    const branchName = `update-packages-${timestamp}`;
    try {
      const result = await updateRepo({
        repoPath: repo,
        packages,
        versions,
        branchName,
        prTitle,
        prBody,
        resetHard,
      });
      results.push({ repo, success: result });
    } catch (err) {
      if (err.code === 5) throw err;
      results.push({ repo, success: false, error: err.message });
    }
  }

  log.info(chalk.cyan('\n-------------------------------------'));
  log.success(chalk.green('Package update process completed.'));

  log.info(chalk.cyan('\nSummary:'));
  for (const result of results) {
    if (result.success) {
      log.success(chalk.green(`${result.repo}: Success`));
    } else {
      log.error(chalk.red(`${result.repo}: Failed`));
    }
  }

  return results.every((r) => r.success);
}

module.exports = {
  updatePackages,
  checkGhLogin,
  packageExists,
  getCurrentVersion,
  versionIsHigherOrEqual,
  updatePackageJson,
  updateRepo,
  checkWorkingTreeClean,
};
