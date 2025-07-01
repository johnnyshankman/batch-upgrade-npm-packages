# Batch Upgrade NPM Packages

A command-line tool to upgrade npm packages across multiple repositories with automatic PR creation.

[![npm version](https://img.shields.io/npm/v/batch-upgrade-npm-packages.svg)](https://www.npmjs.com/package/batch-upgrade-npm-packages)

## Features

- Update npm packages across multiple repositories in one go
- Create unique branches for changes in each repository
- Create pull requests automatically for code review
- Verify package installation with both force and regular installs
- Skip packages already at or above the requested version
- Command-line and interactive modes
- Colorful terminal output for better visibility

## Requirements

- Node.js 14 or higher
- Git
- GitHub CLI (gh) - Must be authenticated before running
- npm

## Installation

### Global Installation (Recommended)

```bash
npm install -g batch-upgrade-npm-packages
```

### Project Installation

```bash
npm install batch-upgrade-npm-packages
```

## Authentication Setup

Before using this tool, you need to authenticate with GitHub CLI:

```bash
gh auth login
```

Follow the prompts to complete the authentication process.

## Usage

### Interactive Mode

The easiest way to use this tool is in interactive mode:

```bash
batch-upgrade-npm -i
```

This will guide you through the process with prompts for:
1. Packages to update (space-separated)
2. Version ranges (space-separated, matching package order)
3. Repository paths (space-separated, relative to current directory)

### Command Line Mode

You can also provide all parameters on the command line:

```bash
batch-upgrade-npm -p package1 package2 -v "^1.0.0" "^2.0.0" -r repo1 repo2
```

Where:
- `-p, --packages`: Space-separated list of packages to update
- `-v, --versions`: Space-separated list of version ranges (must match packages in order)
- `-r, --repos`: Space-separated list of repository paths relative to current directory

### Examples

Update multiple packages in multiple repositories:

```bash
batch-upgrade-npm -p @company/pkg1 @company/pkg2 -v "^1.0.0" "^2.2.1" -r repo1 repo2
```

Update a single package in a single repository:

```bash
batch-upgrade-npm -p react -v "^18.0.0" -r my-app
```

## How It Works

For each repository, the tool will:

1. Check out the main branch and pull latest changes
2. Create a new branch for package updates
3. Update the specified packages to their target versions
   - Skip packages not found in the repository
   - Skip packages already at or above the requested version
4. Verify installations using:
   - Remove node_modules directory for a clean environment
   - First attempt with 'npm install --force'
   - Remove node_modules again
   - Second verification with regular 'npm install'
5. Commit changes if any updates were made
6. Push the branch to origin
7. Create a pull request with details of the updates (only if changes were made)

## Safety Features

- Will not commit directly to main branch
- Discards any uncommitted changes in repositories
- Validates GitHub CLI authentication before proceeding
- Creates descriptive pull requests for review before merging
- Cleans up branches if no changes were made
- Double verification of package installations
- Clean node_modules removal before installations
- Skips updating packages that are already up-to-date
- Skips creating PRs when no changes were made

## License

MIT