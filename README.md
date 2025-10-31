# Batch Upgrade NPM Packages

A professional command-line tool designed to streamline npm package upgrades across multiple repositories with automated pull request creation and intelligent version management.

[![npm version](https://img.shields.io/npm/v/batch-upgrade-npm-packages.svg)](https://www.npmjs.com/package/batch-upgrade-npm-packages)

## Overview

Maintaining consistent package versions across multiple repositories is a critical but time-consuming task in modern software development. This tool automates the entire workflow—from version updates to PR creation—ensuring your dependencies stay current while maintaining code quality through automated verification and review processes.

## Key Features

### Intelligent Version Management
- **Smart Version Comparison**: Automatically skips packages already at or above the target version using semantic versioning
- **Multi-Package Support**: Update multiple packages simultaneously with independent version targets
- **Dependency Detection**: Searches across dependencies, devDependencies, and peerDependencies sections
- **Missing Package Handling**: Gracefully skips packages not present in a repository without failing the entire operation

### Automated Git Workflow
- **Branch Management**: Creates timestamped feature branches for each repository to enable parallel reviews
- **Clean State Enforcement**: Discards uncommitted changes and pulls latest from main before starting
- **Intelligent Commits**: Only commits and pushes when actual changes are detected
- **Automatic Cleanup**: Removes feature branches when no updates were necessary

### Pull Request Automation
- **Dynamic PR Generation**: Creates pull requests with detailed package update information
- **Smart PR Content**: PR titles and descriptions automatically reflect only the packages that were actually updated
- **GitHub Integration**: Seamless integration with GitHub CLI for authenticated PR creation
- **Repository Links**: Includes link to the automation tool in PR descriptions for transparency

### Robust Installation Verification
- **Dual-Pass Verification**: Performs two installation cycles to ensure package compatibility
  1. Force installation to update package-lock.json and resolve conflicts
  2. Clean installation to verify packages install correctly in a fresh environment
- **Clean Environment Testing**: Removes node_modules between installations to simulate fresh deployments
- **Early Failure Detection**: Identifies installation issues before code review

### User Experience
- **Interactive Mode**: Guided prompts for easy operation without memorizing command syntax
- **CLI Mode**: Full command-line interface for automation and scripting
- **Colorized Output**: Clear visual feedback using color-coded terminal messages
- **Progress Indicators**: Real-time status updates with loading spinners
- **Comprehensive Summary**: Detailed success/failure report for all repositories

## System Requirements

- **Node.js**: Version 14.0.0 or higher
- **Git**: For repository operations
- **GitHub CLI (gh)**: Required for pull request creation
- **npm**: For package management

## Installation

### Global Installation (Recommended)

Install globally to use the tool from any directory:

```bash
npm install -g batch-upgrade-npm-packages
```

### Local Installation

Install as a project dependency:

```bash
npm install batch-upgrade-npm-packages
```

When installed locally, run using npx:

```bash
npx batch-upgrade-npm
```

## Authentication Setup

Before first use, authenticate with GitHub CLI to enable automated pull request creation:

```bash
gh auth login
```

Follow the interactive prompts to complete authentication. The tool will verify authentication status before each run.

## Usage

### Interactive Mode (Recommended for Manual Use)

Launch the interactive wizard with guided prompts:

```bash
batch-upgrade-npm -i
```

You will be prompted for:

1. **Packages to update**: Space-separated package names (e.g., `react lodash axios`)
2. **Version ranges**: Space-separated versions matching package order (e.g., `^18.0.0 ^4.17.21 ^1.0.0`)
3. **Repository paths**: Space-separated paths relative to current directory (e.g., `./frontend ./backend ./shared`)

The tool will display a confirmation summary before proceeding.

### Command-Line Mode (Recommended for Automation)

Provide all parameters via command-line flags:

```bash
batch-upgrade-npm -p <packages> -v <versions> -r <repos>
```

#### Options

| Flag | Long Form | Description | Required |
|------|-----------|-------------|----------|
| `-i` | `--interactive` | Launch interactive mode with prompts | No |
| `-p` | `--packages` | Space-separated list of package names | Yes* |
| `-v` | `--versions` | Space-separated version ranges (must match package count and order) | Yes* |
| `-r` | `--repos` | Space-separated repository paths (relative to current directory) | Yes* |

\* Required unless using interactive mode (`-i`)

## Usage Examples

### Example 1: Update Single Package Across Multiple Repositories

Update React to version 18 in three repositories:

```bash
batch-upgrade-npm -p react -v "^18.0.0" -r ./web-app ./admin-dashboard ./mobile-web
```

### Example 2: Update Multiple Packages in Single Repository

Update several packages in one project:

```bash
batch-upgrade-npm \
  -p lodash axios moment \
  -v "^4.17.21" "^1.4.0" "^2.29.4" \
  -r ./my-project
```

### Example 3: Organization-Wide Package Update

Update shared internal packages across all team repositories:

```bash
batch-upgrade-npm \
  -p @company/ui-components @company/api-client @company/utils \
  -v "^2.1.0" "^1.5.0" "^3.0.0" \
  -r ./repo1 ./repo2 ./repo3 ./repo4
```

### Example 4: Mixed Scoped and Regular Packages

Combine scoped and regular packages:

```bash
batch-upgrade-npm \
  -p @types/node @types/react typescript \
  -v "^18.0.0" "^18.0.0" "^5.0.0" \
  -r ./backend
```

### Example 5: Using Version Ranges

Specify different version range strategies:

```bash
batch-upgrade-npm \
  -p package-a package-b package-c \
  -v "^1.0.0" "~2.3.0" "3.5.0" \
  -r ./project
```

- `^1.0.0` - Compatible with version 1.x.x
- `~2.3.0` - Compatible with version 2.3.x
- `3.5.0` - Exact version

## How It Works

### Workflow Overview

For each specified repository, the tool executes the following workflow:

#### 1. Repository Preparation
- Validates GitHub CLI authentication
- Navigates to repository directory
- Discards any uncommitted changes (`git reset --hard HEAD`)
- Checks out main branch
- Pulls latest changes from origin/main

#### 2. Branch Creation
- Generates unique branch name with timestamp: `update-packages-YYYYMMDDHHmmss`
- Creates and checks out new feature branch

#### 3. Package Analysis and Updates
- Reads package.json from repository
- For each specified package:
  - **Not Found**: Logs warning and skips (does not fail)
  - **Already Up-to-Date**: Compares current version with target using semantic versioning
    - If current ≥ target: Logs info and skips
    - If current < target: Proceeds with update
  - **Needs Update**: Updates version in appropriate dependency section

#### 4. Installation Verification (Two-Phase)
- **Phase 1 - Force Install**:
  - Removes entire node_modules directory
  - Executes `npm install --force` to update package-lock.json and resolve conflicts
  - Validates successful completion

- **Phase 2 - Clean Install**:
  - Removes node_modules directory again
  - Executes standard `npm install` to verify clean installation
  - Ensures packages install correctly in fresh environment

#### 5. Change Detection and Commit
- Checks for changes in package.json and package-lock.json
- **If changes detected**:
  - Stages both files
  - Creates commit with descriptive message listing updated packages
  - Pushes branch to origin with upstream tracking
- **If no changes detected**:
  - Checks out main branch
  - Deletes feature branch (cleanup)
  - Skips PR creation

#### 6. Pull Request Creation
- Creates GitHub pull request with:
  - **Title**: Lists all updated packages with versions
  - **Body**: Bulleted list of package updates with source attribution
  - **Base Branch**: main
- Returns PR URL for review

#### 7. Summary Report
- Displays color-coded summary for all repositories
- Shows success/failure status for each operation

## Safety Features

The tool implements multiple safety mechanisms to protect your repositories:

### Git Safety
- **No Direct Main Commits**: All changes occur on feature branches
- **Clean Slate Policy**: Discards uncommitted changes before starting to prevent merge conflicts
- **Latest Code**: Always pulls from origin/main before creating feature branch
- **Isolated Changes**: Each repository gets its own timestamped branch

### Package Management Safety
- **Version Validation**: Uses semantic versioning to prevent downgrades
- **Selective Updates**: Only modifies packages that need updating
- **Non-Destructive**: Never adds new packages, only updates existing ones
- **Missing Package Tolerance**: Gracefully handles packages not present in repository

### Installation Safety
- **Dual Verification**: Two-phase installation process catches compatibility issues
- **Clean Environment**: Removes node_modules between installs to simulate production
- **Failure Detection**: Stops process if either installation phase fails
- **Lock File Updates**: Ensures package-lock.json stays synchronized

### Review Process Safety
- **No Auto-Merge**: All changes require pull request review
- **Detailed PRs**: Clear descriptions of what changed and why
- **Branch Cleanup**: Automatically removes branches when no changes were made
- **Conditional PRs**: Only creates pull requests when actual updates occurred

### Error Handling
- **Authentication Check**: Validates GitHub CLI login before starting
- **Repository Validation**: Confirms repository exists and is accessible
- **Input Validation**: Ensures package and version counts match
- **Non-Blocking Failures**: One repository failure doesn't stop others

## Understanding the Output

### Color-Coded Messages

The tool uses color-coded terminal output for quick status identification:

- **Blue**: Informational messages about current operations
- **Green**: Successful operations and confirmations
- **Yellow**: Warnings and skipped operations (non-critical)
- **Red**: Errors and failures
- **Cyan**: Section headers and summaries

### Common Messages

**"Skipping [package]: Not found in package.json"**
- Package doesn't exist in this repository
- Not an error; tool continues with other packages

**"Skipping [package]: Current version X is already >= Y"**
- Package is already at target version or higher
- No update necessary

**"No changes detected in package.json or package-lock.json. Skipping PR creation."**
- All packages were either missing or already up-to-date
- Branch automatically cleaned up

**"Pull request created successfully for [repo]"**
- Changes committed, pushed, and PR created
- Ready for review

## Troubleshooting

### "You are not logged into GitHub CLI"
**Solution**: Run `gh auth login` and follow authentication prompts

### "Could not switch to main branch"
**Solution**: Ensure repository has a 'main' branch (tool expects 'main' not 'master')

### "Force installation failed" or "Regular installation failed"
**Solution**: Check for:
- Package compatibility issues
- Network connectivity problems
- Private package authentication
- Disk space availability

### Version count doesn't match package count
**Solution**: Ensure you provide exactly one version for each package in the same order

### Repository path not found
**Solution**: Verify repository paths are correct and relative to your current working directory

## Use Cases

### Scenario 1: Security Vulnerability Patch
Quickly update a vulnerable package across all affected repositories:

```bash
batch-upgrade-npm -p lodash -v "^4.17.21" -r ./app1 ./app2 ./app3
```

### Scenario 2: Major Framework Upgrade
Update React and related packages across frontend applications:

```bash
batch-upgrade-npm \
  -p react react-dom @types/react @types/react-dom \
  -v "^18.2.0" "^18.2.0" "^18.2.0" "^18.2.0" \
  -r ./web-client ./admin-ui ./customer-portal
```

### Scenario 3: Internal Package Updates
Roll out new versions of internal shared libraries:

```bash
batch-upgrade-npm \
  -p @company/design-system @company/shared-utils \
  -v "^3.1.0" "^2.5.0" \
  -r ./service-a ./service-b ./service-c
```

### Scenario 4: Dependency Maintenance
Regular dependency updates for better maintainability:

```bash
batch-upgrade-npm -i  # Use interactive mode for exploration
```

## Best Practices

### Before Running
1. Ensure all target repositories are pushed and have no pending changes
2. Verify GitHub CLI authentication is active (`gh auth status`)
3. Confirm you have appropriate repository access permissions
4. Review current package versions to avoid unnecessary work

### Version Selection
- Use caret (`^`) for minor and patch updates: `^1.2.3` allows `1.x.x`
- Use tilde (`~`) for patch-only updates: `~1.2.3` allows `1.2.x`
- Use exact versions for critical dependencies: `1.2.3`
- Check changelogs before major version bumps

### Repository Organization
- Run from a parent directory containing all target repositories
- Use relative paths for repository arguments
- Group related repositories for batch operations

### Review Process
- Review PRs promptly to avoid merge conflicts
- Test changes in CI/CD before merging
- Merge PRs individually to isolate potential issues
- Monitor application behavior after merging

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

MIT

## Links

- [npm Package](https://www.npmjs.com/package/batch-upgrade-npm-packages)
- [GitHub Repository](https://github.com/anthropics/batch-upgrade-npm-packages)

---

**Automatically generated by batch-upgrade-npm-packages**
