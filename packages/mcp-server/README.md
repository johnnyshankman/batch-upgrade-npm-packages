# Batch Upgrade NPM Packages MCP Server

An MCP (Model Context Protocol) server that enables AI models to upgrade npm packages across multiple repositories by creating pull requests.

## Installation

```bash
npm install -g batch-upgrade-npm-packages-mcp
```

## Prerequisites

- Node.js 16 or higher
- Git installed and configured
- GitHub CLI (`gh`) installed and authenticated (`gh auth login`)
- npm installed
- Access to the repositories you want to update

## Usage with Claude Desktop

Add to your Claude Desktop configuration file:

### macOS
Location: `~/Library/Application Support/Claude/claude_desktop_config.json`

### Windows
Location: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "batch-upgrade": {
      "command": "npx",
      "args": ["batch-upgrade-npm-packages-mcp"]
    }
  }
}
```

## How It Works

The MCP server provides a single tool called `upgrade-npm-packages` that:
1. Takes arrays of packages, versions, and repository paths
2. Runs the batch upgrade script for each repository
3. Creates pull requests with the changes
4. Returns the PR URLs

## Example Usage

When talking to Claude, you can say:

- "Please upgrade @myorg/package1 to ^2.0.0 and lodash to ^4.17.21 in repositories repo1 and repo2"
- "Update react to ^18.0.0 in my-app repository"
- "Upgrade all @company packages to version ^3.0.0 in all our frontend repos"

Claude will use the tool to create pull requests for each repository with the specified package updates.

## Tool Parameters

The `upgrade-npm-packages` tool accepts:

- `packages`: Array of package names to upgrade (e.g., `["@org/pkg1", "lodash"]`)
- `versions`: Array of target versions matching package order (e.g., `["^1.2.0", "^4.17.21"]`)
- `repositories`: Array of repository paths relative to working directory

## Features

- Automatic branch creation for each repository
- Pull request creation with detailed descriptions
- Progress updates during execution
- Skips packages already at or above target version
- Safety checks to prevent direct commits to main branch

## License

MIT