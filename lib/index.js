const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const semver = require('semver');
const chalk = require('chalk');

/**
 * Check if GitHub CLI is logged in
 * @returns {boolean} true if logged in, false otherwise
 */
function checkGhLogin() {
  try {
    console.log(chalk.blue('Checking if you\'re logged into GitHub CLI...'));
    execSync('gh auth status', { stdio: 'ignore' });
    console.log(chalk.green('GitHub CLI authentication confirmed.'));
    return true;
  } catch (error) {
    console.error(chalk.red('Error: You are not logged into GitHub CLI. Please run \'gh auth login\' first.'));
    return false;
  }
}

/**
 * Check if a package exists in package.json
 * @param {string} pkg - Package name
 * @param {string} packageJsonPath - Path to package.json
 * @returns {boolean} true if package exists, false otherwise
 */
function packageExists(pkg, packageJsonPath = 'package.json') {
  if (!fs.existsSync(packageJsonPath)) {
    return false;
  }

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

/**
 * Get the current version of a package from package.json
 * @param {string} pkg - Package name
 * @param {string} packageJsonPath - Path to package.json
 * @returns {Object|null} Object with section and version, or null if not found
 */
function getCurrentVersion(pkg, packageJsonPath = 'package.json') {
  if (!fs.existsSync(packageJsonPath)) {
    return null;
  }

  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const sections = ['dependencies', 'devDependencies', 'peerDependencies'];

    for (const section of sections) {
      if (packageJson[section] && packageJson[section][pkg]) {
        return {
          section,
          version: packageJson[section][pkg]
        };
      }
    }
    return null;
  } catch (error) {
    console.error(chalk.red(`Error getting current version for ${pkg}: ${error.message}`));
    return null;
  }
}

/**
 * Compare versions - returns true if current version is >= target version
 * @param {string} current - Current version
 * @param {string} target - Target version
 * @returns {boolean} true if current version is >= target version
 */
function versionIsHigherOrEqual(current, target) {
  // Remove any caret, tilde or equals prefix from versions for comparison
  const cleanCurrent = current.replace(/^[\^~=]/, '');
  const cleanTarget = target.replace(/^[\^~=]/, '');

  return semver.gte(cleanCurrent, cleanTarget);
}

/**
 * Update package.json with new package version
 * @param {string} pkg - Package name
 * @param {string} section - Section in package.json (dependencies, devDependencies, peerDependencies)
 * @param {string} version - New version
 * @param {string} packageJsonPath - Path to package.json
 * @returns {boolean} true if update was successful, false otherwise
 */
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

/**
 * Execute a command in a specific directory
 * @param {string} command - Command to execute
 * @param {string} cwd - Working directory
 * @returns {Promise<{success: boolean, output: string}>} Result of command execution
 */
function executeCommand(command, cwd) {
  return new Promise((resolve) => {
    let output = '';

    const [cmd, ...args] = command.split(' ');
    const proc = spawn(cmd, args, { cwd, shell: true });

    proc.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      process.stdout.write(text);
    });

    proc.stderr.on('data', (data) => {
      const text = data.toString();
      output += text;
      process.stderr.write(text);
    });

    proc.on('close', (code) => {
      resolve({
        success: code === 0,
        output
      });
    });
  });
}

/**
 * Update a repository with new package versions
 * @param {Object} options - Options object
 * @param {string} options.repoPath - Repository path
 * @param {string[]} options.packages - Packages to update
 * @param {string[]} options.versions - Version ranges
 * @param {string} options.branchName - Branch name
 * @param {string} options.prTitle - PR title
 * @param {string} options.prBody - PR body
 * @returns {Promise<boolean>} true if update was successful, false otherwise
 */
async function updateRepo(options) {
  const { repoPath, packages, versions, branchName, prTitle, prBody } = options;
  const originalDir = process.cwd();

  console.log(chalk.cyan('\n-------------------------------------'));
  console.log(chalk.cyan(`Processing repository: ${repoPath}`));

  try {
    // Navigate to the repository
    process.chdir(path.resolve(repoPath));

    // Discard any uncommitted changes
    await executeCommand('git reset --hard HEAD');

    // Switch to main branch
    console.log(chalk.blue('Switching to main branch...'));
    const mainResult = await executeCommand('git checkout main');
    if (!mainResult.success) {
      console.error(chalk.red(`Error: Could not switch to main branch in ${repoPath}`));
      process.chdir(originalDir);
      return false;
    }

    // Pull latest changes
    console.log(chalk.blue('Pulling latest changes from origin/main...'));
    const pullResult = await executeCommand('git pull origin main');
    if (!pullResult.success) {
      console.error(chalk.red(`Error: Could not pull latest changes in ${repoPath}`));
      process.chdir(originalDir);
      return false;
    }

    // Create and switch to a new branch
    console.log(chalk.blue(`Creating and switching to new branch: ${branchName}...`));
    const branchResult = await executeCommand(`git checkout -b ${branchName}`);
    if (!branchResult.success) {
      console.error(chalk.red(`Error: Could not create new branch in ${repoPath}`));
      process.chdir(originalDir);
      return false;
    }

    // Update each package
    console.log(chalk.blue('Checking packages:'));
    let updateSuccess = false;
    const updatedPackages = [];
    const updatedVersions = [];

    // If package.json exists, update it directly
    if (fs.existsSync('package.json')) {
      // Create a backup of package.json
      fs.copyFileSync('package.json', 'package.json.bak');

      // Update each package version directly in package.json
      console.log(chalk.blue('Analyzing package versions in package.json...'));

      for (let i = 0; i < packages.length; i++) {
        const pkg = packages[i];
        const ver = versions[i];

        // Skip packages that don't exist in package.json
        if (!packageExists(pkg)) {
          console.log(chalk.yellow(`  - Skipping ${pkg}: Not found in package.json`));
          continue;
        }

        // Check current version in different dependency sections
        const currentVersionInfo = getCurrentVersion(pkg);

        if (!currentVersionInfo) {
          console.log(chalk.yellow(`  - Warning: Could not determine current version of ${pkg}`));
          continue;
        }

        const { section, version: currentVersion } = currentVersionInfo;

        // Compare versions and skip if current is >= target
        if (versionIsHigherOrEqual(currentVersion, ver)) {
          console.log(chalk.yellow(`  - Skipping ${pkg}: Current version ${currentVersion} is already >= ${ver}`));
          continue;
        }

        console.log(chalk.green(`  - Updating ${pkg} from ${currentVersion} to ${ver} in ${section} section`));

        // Add to our list of packages that will be updated
        updatedPackages.push(pkg);
        updatedVersions.push(ver);

        // Update the package version
        const updated = updatePackageJson(pkg, section, ver);
        if (updated) {
          updateSuccess = true;
        } else {
          console.log(chalk.yellow(`  - Warning: Could not update ${pkg} in package.json`));
        }
      }

      // If no updates were made, restore the backup
      if (!updateSuccess) {
        fs.copyFileSync('package.json.bak', 'package.json');
        console.log(chalk.yellow('No packages were updated in package.json'));
      }

      // Remove backup
      fs.unlinkSync('package.json.bak');
    }

    // Verify installation with --force followed by regular install
    if (updateSuccess) {
      console.log(chalk.blue('Removing node_modules directory for clean installation...'));
      try {
        if (fs.existsSync('node_modules')) {
          fs.rmSync('node_modules', { recursive: true, force: true });
        }
      } catch (err) {
        console.error(chalk.red(`Error removing node_modules: ${err.message}`));
      }

      // First run with --force to update package-lock.json and dependencies
      console.log(chalk.blue('Updating package-lock.json and verifying installation with npm install --force...'));
      const forceInstallResult = await executeCommand('npm install --force');
      if (!forceInstallResult.success) {
        console.error(chalk.red(`Error: Force installation failed in ${repoPath}`));
        process.chdir(originalDir);
        return false;
      }

      console.log(chalk.blue('Removing node_modules directory again before verification...'));
      try {
        if (fs.existsSync('node_modules')) {
          fs.rmSync('node_modules', { recursive: true, force: true });
        }
      } catch (err) {
        console.error(chalk.red(`Error removing node_modules: ${err.message}`));
      }

      // Second run without --force for final verification
      console.log(chalk.blue('Verifying package installation with regular npm install...'));
      const regularInstallResult = await executeCommand('npm install');
      if (!regularInstallResult.success) {
        console.error(chalk.red(`Error: Regular installation failed after forced install in ${repoPath}`));
        process.chdir(originalDir);
        return false;
      }

      console.log(chalk.green('Package installation verified successfully.'));
    }

    // Check if there are changes to commit
    const diffResult = await executeCommand('git diff --quiet package.json package-lock.json || echo "changes"');

    if (diffResult.output.includes('changes')) {
      console.log(chalk.blue('Changes detected. Committing and pushing...'));

      // Update PR title and body to only include packages that were actually updated
      let updatedPackageList = '';
      let updatedPrBody = 'This PR updates the following npm packages:\n\n';

      for (let i = 0; i < updatedPackages.length; i++) {
        if (i > 0) {
          updatedPackageList += ', ';
        }
        updatedPackageList += `${updatedPackages[i]}@${updatedVersions[i]}`;
        updatedPrBody += `- ${updatedPackages[i]} to ${updatedVersions[i]}\n`;
      }

      updatedPrBody += '\nAutomatically generated by batch-upgrade-npm-packages.';

      // Use the updated title if we have updated packages
      let finalPrTitle = prTitle;
      let finalPrBody = prBody;

      if (updatedPackageList) {
        finalPrTitle = `Update npm packages: ${updatedPackageList}`;
        finalPrBody = updatedPrBody;
      }

      await executeCommand('git add package.json package-lock.json');
      await executeCommand(`git commit -m "${finalPrTitle}"`);

      // Push the changes
      console.log(chalk.blue('Pushing changes...'));
      const pushResult = await executeCommand(`git push --set-upstream origin "${branchName}"`);
      if (!pushResult.success) {
        console.error(chalk.red(`Error: Could not push changes for ${repoPath}`));
        process.chdir(originalDir);
        return false;
      }

      // Create a PR
      console.log(chalk.blue('Creating pull request...'));
      const prResult = await executeCommand(`gh pr create --title "${finalPrTitle}" --body "${finalPrBody}" --base main`);
      if (!prResult.success) {
        console.error(chalk.red(`Error: Could not create PR for ${repoPath}`));
        process.chdir(originalDir);
        return false;
      }

      console.log(chalk.green(`Pull request created successfully for ${repoPath}`));
    } else {
      console.log(chalk.yellow('No changes detected in package.json or package-lock.json. Skipping PR creation.'));
      // Clean up the branch since we didn't make any changes
      await executeCommand('git checkout main');
      await executeCommand(`git branch -D ${branchName}`);
    }

    // Return to the original directory
    process.chdir(originalDir);
    console.log(chalk.green(`Completed processing ${repoPath}`));
    return true;
  } catch (error) {
    console.error(chalk.red(`Error processing repository ${repoPath}: ${error.message}`));
    process.chdir(originalDir);
    return false;
  }
}

/**
 * Main function to update packages across repositories
 * @param {Object} options - Options object
 * @param {string[]} options.packages - Packages to update
 * @param {string[]} options.versions - Version ranges
 * @param {string[]} options.repos - Repository paths
 * @returns {Promise<boolean>} true if update was successful, false otherwise
 */
async function updatePackages(options) {
  const { packages, versions, repos } = options;

  // Check that gh CLI is logged in
  if (!checkGhLogin()) {
    return false;
  }

  // Validate input
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

  // Generate a timestamp for branch names
  const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);

  // Create PR title and description
  let packageList = '';
  for (let i = 0; i < packages.length; i++) {
    if (i > 0) {
      packageList += ', ';
    }
    packageList += `${packages[i]}@${versions[i]}`;
  }

  const prTitle = `Update npm packages: ${packageList}`;

  // Create PR body with proper newlines
  let prBody = 'This PR updates the following npm packages:\n\n';
  for (let i = 0; i < packages.length; i++) {
    prBody += `- ${packages[i]} to ${versions[i]}\n`;
  }
  prBody += '\nAutomatically generated by batch-upgrade-npm-packages.';

  // Process each repository
  const results = [];
  for (const repo of repos) {
    // Create a unique branch name
    const branchName = `update-packages-${timestamp}`;

    // Update the repository
    const result = await updateRepo({
      repoPath: repo,
      packages,
      versions,
      branchName,
      prTitle,
      prBody
    });

    results.push({ repo, success: result });
  }

  console.log(chalk.cyan('\n-------------------------------------'));
  console.log(chalk.green('Package update process completed.'));

  // Print summary
  console.log(chalk.cyan('\nSummary:'));
  for (const result of results) {
    if (result.success) {
      console.log(chalk.green(`${result.repo}: Success`));
    } else {
      console.log(chalk.red(`${result.repo}: Failed`));
    }
  }

  return true;
}

module.exports = {
  updatePackages,
  checkGhLogin,
  packageExists,
  getCurrentVersion,
  versionIsHigherOrEqual,
  updatePackageJson,
  updateRepo
};
