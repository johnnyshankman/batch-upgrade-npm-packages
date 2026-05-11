const fs = require('fs');
const path = require('path');
const semver = require('semver');
const chalk = require('chalk');
const { runCmd } = require('./runCmd');

async function checkGhLogin() {
  console.log(chalk.blue("Checking if you're logged into GitHub CLI..."));
  const r = await runCmd('gh', ['auth', 'status'], { stream: false });
  if (r.success) {
    console.log(chalk.green('GitHub CLI authentication confirmed.'));
    return true;
  }
  console.error(
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
    console.error(chalk.red(`Error checking if package ${pkg} exists: ${error.message}`));
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
    console.error(chalk.red(`Error getting current version for ${pkg}: ${error.message}`));
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
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
      return true;
    }
    return false;
  } catch (error) {
    console.error(chalk.red(`Error updating package.json for ${pkg}: ${error.message}`));
    return false;
  }
}

async function checkWorkingTreeClean(repoCwd) {
  const r = await runCmd('git', ['status', '--porcelain'], { cwd: repoCwd, stream: false });
  if (!r.success) {
    return { clean: false, reason: 'git-status-failed', stderr: r.stderr };
  }
  return { clean: r.stdout.trim() === '', porcelain: r.stdout };
}

async function updateRepo(options) {
  const {
    repoPath,
    packages,
    versions,
    branchName,
    prTitle,
    prBody,
    resetHard = false,
  } = options;
  const repoCwd = path.resolve(repoPath);
  const packageJsonPath = path.join(repoCwd, 'package.json');

  console.log(chalk.cyan('\n-------------------------------------'));
  console.log(chalk.cyan(`Processing repository: ${repoPath}`));

  try {
    const cleanCheck = await checkWorkingTreeClean(repoCwd);
    if (!cleanCheck.clean) {
      if (cleanCheck.reason === 'git-status-failed') {
        console.error(chalk.red(`Error: Could not read git status in ${repoPath}`));
        console.error(chalk.red('  → Try: cd ' + repoPath + ' && git status'));
        const e = new Error(`Could not read git status in ${repoPath}`);
        e.code = 1;
        throw e;
      }
      if (!resetHard) {
        console.error(
          chalk.red(`Error: Uncommitted changes in ${repoPath}. Refusing to overwrite.`)
        );
        console.error(
          chalk.red(
            '  → Try: commit or stash your work, OR re-run with --reset-hard (destroys uncommitted changes)'
          )
        );
        const e = new Error(`Uncommitted changes in ${repoPath}`);
        e.code = 5;
        throw e;
      }
      console.log(chalk.yellow('Discarding uncommitted changes (--reset-hard)...'));
      const resetResult = await runCmd('git', ['reset', '--hard', 'HEAD'], { cwd: repoCwd });
      if (!resetResult.success) {
        console.error(chalk.red(`Error: git reset --hard failed in ${repoPath}`));
        return false;
      }
    }

    console.log(chalk.blue('Switching to main branch...'));
    const mainResult = await runCmd('git', ['checkout', 'main'], { cwd: repoCwd });
    if (!mainResult.success) {
      console.error(chalk.red(`Error: Could not switch to main branch in ${repoPath}`));
      return false;
    }

    console.log(chalk.blue('Pulling latest changes from origin/main...'));
    const pullResult = await runCmd('git', ['pull', 'origin', 'main'], { cwd: repoCwd });
    if (!pullResult.success) {
      console.error(chalk.red(`Error: Could not pull latest changes in ${repoPath}`));
      return false;
    }

    console.log(chalk.blue(`Creating and switching to new branch: ${branchName}...`));
    const branchResult = await runCmd('git', ['checkout', '-b', branchName], { cwd: repoCwd });
    if (!branchResult.success) {
      console.error(chalk.red(`Error: Could not create new branch in ${repoPath}`));
      return false;
    }

    console.log(chalk.blue('Checking packages:'));
    let updateSuccess = false;
    const updatedPackages = [];
    const updatedVersions = [];

    if (fs.existsSync(packageJsonPath)) {
      const backupPath = packageJsonPath + '.bak';
      fs.copyFileSync(packageJsonPath, backupPath);

      console.log(chalk.blue('Analyzing package versions in package.json...'));

      for (let i = 0; i < packages.length; i++) {
        const pkg = packages[i];
        const ver = versions[i];

        if (!packageExists(pkg, packageJsonPath)) {
          console.log(chalk.yellow(`  - Skipping ${pkg}: Not found in package.json`));
          continue;
        }

        const currentVersionInfo = getCurrentVersion(pkg, packageJsonPath);
        if (!currentVersionInfo) {
          console.log(chalk.yellow(`  - Warning: Could not determine current version of ${pkg}`));
          continue;
        }

        const { section, version: currentVersion } = currentVersionInfo;

        if (versionIsHigherOrEqual(currentVersion, ver)) {
          console.log(
            chalk.yellow(
              `  - Skipping ${pkg}: Current version ${currentVersion} is already >= ${ver}`
            )
          );
          continue;
        }

        console.log(
          chalk.green(`  - Updating ${pkg} from ${currentVersion} to ${ver} in ${section} section`)
        );

        updatedPackages.push(pkg);
        updatedVersions.push(ver);

        const updated = updatePackageJson(pkg, section, ver, packageJsonPath);
        if (updated) {
          updateSuccess = true;
        } else {
          console.log(chalk.yellow(`  - Warning: Could not update ${pkg} in package.json`));
        }
      }

      if (!updateSuccess) {
        fs.copyFileSync(backupPath, packageJsonPath);
        console.log(chalk.yellow('No packages were updated in package.json'));
      }
      fs.unlinkSync(backupPath);
    }

    if (updateSuccess) {
      const nodeModulesPath = path.join(repoCwd, 'node_modules');
      console.log(chalk.blue('Removing node_modules directory for clean installation...'));
      try {
        if (fs.existsSync(nodeModulesPath)) {
          fs.rmSync(nodeModulesPath, { recursive: true, force: true });
        }
      } catch (err) {
        console.error(chalk.red(`Error removing node_modules: ${err.message}`));
      }

      console.log(
        chalk.blue('Updating package-lock.json and verifying installation with npm install --force...')
      );
      const forceInstallResult = await runCmd('npm', ['install', '--force'], { cwd: repoCwd });
      if (!forceInstallResult.success) {
        console.error(chalk.red(`Error: Force installation failed in ${repoPath}`));
        console.error(chalk.red('  → Try: cd ' + repoPath + ' && npm install --force  (reproduce locally to see the full error)'));
        return false;
      }

      console.log(chalk.blue('Removing node_modules directory again before verification...'));
      try {
        if (fs.existsSync(nodeModulesPath)) {
          fs.rmSync(nodeModulesPath, { recursive: true, force: true });
        }
      } catch (err) {
        console.error(chalk.red(`Error removing node_modules: ${err.message}`));
      }

      console.log(chalk.blue('Verifying package installation with regular npm install...'));
      const regularInstallResult = await runCmd('npm', ['install'], { cwd: repoCwd });
      if (!regularInstallResult.success) {
        console.error(
          chalk.red(`Error: Regular installation failed after forced install in ${repoPath}`)
        );
        return false;
      }

      console.log(chalk.green('Package installation verified successfully.'));
    }

    const diffResult = await runCmd(
      'git',
      ['diff', '--quiet', '--', 'package.json', 'package-lock.json'],
      { cwd: repoCwd, stream: false }
    );
    const hasChanges = diffResult.exitCode === 1;

    if (hasChanges) {
      console.log(chalk.blue('Changes detected. Committing and pushing...'));

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

      await runCmd('git', ['add', 'package.json', 'package-lock.json'], { cwd: repoCwd });
      await runCmd('git', ['commit', '-m', finalPrTitle], { cwd: repoCwd });

      console.log(chalk.blue('Pushing changes...'));
      const pushResult = await runCmd(
        'git',
        ['push', '--set-upstream', 'origin', branchName],
        { cwd: repoCwd }
      );
      if (!pushResult.success) {
        console.error(chalk.red(`Error: Could not push changes for ${repoPath}`));
        return false;
      }

      console.log(chalk.blue('Creating pull request...'));
      const prResult = await runCmd(
        'gh',
        ['pr', 'create', '--title', finalPrTitle, '--body', finalPrBody, '--base', 'main'],
        { cwd: repoCwd }
      );
      if (!prResult.success) {
        console.error(chalk.red(`Error: Could not create PR for ${repoPath}`));
        return false;
      }

      console.log(chalk.green(`Pull request created successfully for ${repoPath}`));
    } else {
      console.log(
        chalk.yellow('No changes detected in package.json or package-lock.json. Skipping PR creation.')
      );
      await runCmd('git', ['checkout', 'main'], { cwd: repoCwd });
      await runCmd('git', ['branch', '-D', branchName], { cwd: repoCwd });
    }

    console.log(chalk.green(`Completed processing ${repoPath}`));
    return true;
  } catch (error) {
    if (typeof error.code === 'number') throw error;
    console.error(chalk.red(`Error processing repository ${repoPath}: ${error.message}`));
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
    console.error(chalk.red('Error: Number of packages and versions must match.'));
    return false;
  }

  if (packages.length === 0) {
    console.error(chalk.red('Error: No packages specified.'));
    return false;
  }

  if (repos.length === 0) {
    console.error(chalk.red('Error: No repositories specified.'));
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

  console.log(chalk.cyan('\n-------------------------------------'));
  console.log(chalk.green('Package update process completed.'));

  console.log(chalk.cyan('\nSummary:'));
  for (const result of results) {
    if (result.success) {
      console.log(chalk.green(`${result.repo}: Success`));
    } else {
      console.log(chalk.red(`${result.repo}: Failed`));
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
