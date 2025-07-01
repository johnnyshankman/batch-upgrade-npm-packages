# Batch Upgrade NPM Packages - Monorepo

A monorepo containing tools to upgrade npm packages across multiple repositories with automatic PR creation.

This repository contains two packages:
- **batch-upgrade-npm-packages**: CLI tool for batch upgrading npm packages
- **batch-upgrade-npm-packages-mcp**: MCP server for AI-powered package upgrades

## Packages

### 1. [batch-upgrade-npm-packages](./packages/cli)
[![npm version](https://img.shields.io/npm/v/batch-upgrade-npm-packages.svg)](https://www.npmjs.com/package/batch-upgrade-npm-packages)

The original CLI tool for batch upgrading npm packages across multiple repositories.

**Installation:**
```bash
npm install -g batch-upgrade-npm-packages
```

**Quick Start:**
```bash
batch-upgrade-npm -i
```

[View CLI Documentation →](./packages/cli/README.md)

### 2. [batch-upgrade-npm-packages-mcp](./packages/mcp-server)
[![npm version](https://img.shields.io/npm/v/batch-upgrade-npm-packages-mcp.svg)](https://www.npmjs.com/package/batch-upgrade-npm-packages-mcp)

MCP server that enables AI models (like Claude) to use the batch upgrade functionality.

**Installation:**
```bash
npm install -g batch-upgrade-npm-packages-mcp
```

**Configuration for Claude Desktop:**
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

[View MCP Server Documentation →](./packages/mcp-server/README.md)

## Monorepo Development

### Setup
```bash
# Clone the repository
git clone https://github.com/yourusername/batch-upgrade-npm-packages.git
cd batch-upgrade-npm-packages

# Install dependencies for all packages
npm install
```

### Building
```bash
# Build all packages
npm run build

# Build specific package
npm run build -w packages/cli
npm run build -w packages/mcp-server
```

### Testing Locally
```bash
# Link CLI package globally
cd packages/cli
npm link

# Link MCP server globally
cd packages/mcp-server
npm link
```

## Requirements

- Node.js 14+ (16+ for MCP server)
- npm 7+ (for workspaces support)
- Git
- GitHub CLI (gh) - Must be authenticated
- Access to target repositories

## License

MIT
