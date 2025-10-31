# Batch Upgrade NPM Packages

A command-line tool to upgrade npm packages across multiple repositories with automated pull request creation.

[![npm version](https://img.shields.io/npm/v/batch-upgrade-npm-packages.svg)](https://www.npmjs.com/package/batch-upgrade-npm-packages)

## Features

- Update npm packages across multiple repositories simultaneously
- Smart version comparison using semver (skips packages already up-to-date)
- Searches dependencies, devDependencies, and peerDependencies
- Creates timestamped feature branches for each repository
- Dual-phase installation verification (force + clean install)
- Automatic PR creation with detailed update information
- Interactive and CLI modes for different workflows
- Gracefully skips missing packages without failing
- Colorized terminal output with progress indicators
- Automatic branch cleanup when no changes are made

## Requirements

- Node.js 14 or higher
- Git
- GitHub CLI (gh) - Must be authenticated
- npm

## Installation

**Global (Recommended)**
```bash
npm install -g batch-upgrade-npm-packages
```

**Local**
```bash
npm install batch-upgrade-npm-packages
npx batch-upgrade-npm  # to run
```

**Authentication**
```bash
gh auth login
```

## Usage

### Interactive Mode

```bash
batch-upgrade-npm -i
```

Prompts for packages, versions, and repository paths.

### CLI Mode

```bash
batch-upgrade-npm -p <packages> -v <versions> -r <repos>
```

**Options**

| Flag | Description | Required |
|------|-------------|----------|
| `-i, --interactive` | Launch interactive mode | No |
| `-p, --packages` | Space-separated package names | Yes* |
| `-v, --versions` | Space-separated version ranges (must match package order) | Yes* |
| `-r, --repos` | Space-separated repository paths (relative to current directory) | Yes* |

\* Required unless using `-i`

### Examples

**Single package, multiple repositories:**
```bash
batch-upgrade-npm -p react -v "^18.0.0" -r ./web-app ./admin ./mobile
```

**Multiple packages, single repository:**
```bash
batch-upgrade-npm -p lodash axios -v "^4.17.21" "^1.4.0" -r ./my-project
```

**Organization-wide update:**
```bash
batch-upgrade-npm \
  -p @company/ui-components @company/api-client \
  -v "^2.1.0" "^1.5.0" \
  -r ./repo1 ./repo2 ./repo3
```

**Version ranges:**
- `^1.2.3` - Compatible with 1.x.x
- `~1.2.3` - Compatible with 1.2.x
- `1.2.3` - Exact version

## How It Works

For each repository:

1. **Prepare**: Checkout main, pull latest, discard uncommitted changes
2. **Branch**: Create timestamped feature branch (`update-packages-YYYYMMDDHHmmss`)
3. **Analyze**: Check each package version, skip if not found or already up-to-date
4. **Update**: Modify package.json for packages needing updates
5. **Verify**: Run `npm install --force`, then clean `npm install` to validate
6. **Commit**: Stage changes, commit with descriptive message, push to origin
7. **PR**: Create pull request with updated package list (only if changes detected)
8. **Cleanup**: Delete branch if no changes were made

## Safety Features

- All changes on feature branches (never commits to main)
- Validates GitHub CLI authentication before starting
- Uses semantic versioning to prevent downgrades
- Only updates existing packages (never adds new ones)
- Dual-phase installation catches compatibility issues early
- Creates PRs for review (no auto-merge)
- One repository failure doesn't stop others
- Automatic branch cleanup when nothing changes

## Output

**Color codes:**
- Blue: Informational
- Green: Success
- Yellow: Warnings/skips
- Red: Errors
- Cyan: Section headers

**Common messages:**
- `"Skipping [package]: Not found in package.json"` - Package doesn't exist, continuing with others
- `"Skipping [package]: Current version X is already >= Y"` - Already up-to-date
- `"No changes detected..."` - All packages skipped, branch cleaned up

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "You are not logged into GitHub CLI" | Run `gh auth login` |
| "Could not switch to main branch" | Ensure repo has 'main' branch (not 'master') |
| "Installation failed" | Check package compatibility, network, disk space |
| "Version count doesn't match package count" | Provide one version per package in same order |
| "Repository path not found" | Verify paths are relative to current directory |

## Best Practices

- Ensure target repos are clean with no pending changes
- Run from parent directory containing all repositories
- Use `^` for minor/patch updates, `~` for patch-only, exact for critical deps
- Review PRs promptly to avoid merge conflicts
- Test in CI/CD before merging

## License

MIT

## Links

- [npm Package](https://www.npmjs.com/package/batch-upgrade-npm-packages)
- [GitHub Repository](https://github.com/anthropics/batch-upgrade-npm-packages)
