# MCP Server for Batch NPM Package Upgrades

## Executive Summary

This MCP (Model Context Protocol) server exposes functionality to automatically upgrade npm packages across multiple repositories, creating pull requests for each upgrade. It wraps the existing `batch-upgrade-npm-pkgs.sh` script in a structured MCP tool interface.

## Technical Architecture

### System Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   AI Model      │────▶│   MCP Server     │────▶│  Shell Script   │
│  (Claude, etc)  │     │  (TypeScript)    │     │   (Bash)        │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │                          │
                               ▼                          ▼
                        ┌──────────────┐           ┌─────────────┐
                        │   GitHub     │           │ npm/Git     │
                        │   CLI (gh)   │           │ Operations  │
                        └──────────────┘           └─────────────┘
```

### Core Components

#### 1. MCP Server (`src/index.ts`)
- Initializes MCP server with tool capabilities
- Handles stdio transport for communication
- Registers the `upgrade-npm-packages` tool

#### 2. Upgrade Packages Tool (`src/tools/upgrade-packages.ts`)
- Validates input parameters
- Executes pre-flight checks
- Orchestrates the upgrade process
- Returns structured results

#### 3. Shell Executor (`src/utils/shell-executor.ts`)
- Spawns child processes for shell commands
- Streams output in real-time
- Handles process lifecycle and errors

#### 4. Validators (`src/utils/`)
- `git-validator.ts`: Ensures git and gh CLI are available and authenticated
- `package-analyzer.ts`: Analyzes package.json files for version information

## Tool Specification

### Tool: `upgrade-npm-packages`

**Description**: Upgrades npm packages across multiple repositories by creating pull requests

**Input Schema**:
```typescript
{
  packages: string[]      // Required: Package names (e.g., ["@org/pkg1", "lodash"])
  versions: string[]      // Required: Target versions (e.g., ["^1.2.0", "^4.17.21"])
  repositories: string[]  // Required: Repository paths relative to working directory
  baseBranch?: string     // Optional: Base branch name (default: "main")
  dryRun?: boolean       // Optional: Preview changes without creating PRs
  skipVerification?: boolean // Optional: Skip npm install verification
  commitMessage?: string  // Optional: Custom commit message template
}
```

**Output Schema**:
```typescript
{
  success: boolean
  results: Array<{
    repository: string
    status: "success" | "failed" | "skipped"
    branch?: string
    prUrl?: string
    updatedPackages?: Array<{
      name: string
      fromVersion: string
      toVersion: string
    }>
    error?: string
  }>
  summary: {
    totalRepos: number
    successful: number
    failed: number
    skipped: number
  }
}
```

## Implementation Approach

### Phase 1: Core Infrastructure
1. Set up TypeScript project with MCP SDK
2. Implement basic server structure
3. Create tool registration framework

### Phase 2: Shell Script Integration
1. Create shell executor utility
2. Implement streaming output handler
3. Add process management and cleanup

### Phase 3: Tool Implementation
1. Build input validation logic
2. Create pre-flight check system
3. Implement main upgrade orchestration

### Phase 4: Enhanced Features
1. Add progress reporting via MCP progress events
2. Implement dry-run mode
3. Add custom commit message support

### Phase 5: Production Readiness
1. Comprehensive error handling
2. Logging and debugging support
3. Performance optimization
4. Documentation and examples

## Security Considerations

1. **Authentication**: Relies on existing gh CLI authentication
2. **Authorization**: Operates with user's git/GitHub permissions
3. **Input Validation**: Strict validation of all inputs
4. **Command Injection**: No direct shell command construction from user input

## Error Handling Strategy

1. **Pre-flight Failures**: Clear messages about missing dependencies
2. **Repository Errors**: Isolated per-repo, continue with others
3. **Network Issues**: Retry logic with exponential backoff
4. **Version Conflicts**: Skip and report, don't fail entire operation

## Performance Considerations

1. **Parallel Processing**: Process multiple repos concurrently (configurable)
2. **Streaming Output**: Real-time feedback without buffering
3. **Resource Management**: Cleanup temporary branches/files

## Deployment Strategy

### NPM Package Structure
```json
{
  "name": "@yourorg/batch-upgrade-npm-packages-mcp",
  "version": "1.0.0",
  "description": "MCP server for batch upgrading npm packages across repositories",
  "main": "dist/index.js",
  "bin": {
    "batch-upgrade-mcp": "dist/index.js"
  },
  "files": [
    "dist/",
    "scripts/batch-upgrade-npm-pkgs.sh"
  ]
}
```

### Installation & Usage
```bash
# Install globally
npm install -g @yourorg/batch-upgrade-npm-packages-mcp

# Or add to MCP settings
{
  "mcpServers": {
    "batch-upgrade": {
      "command": "npx",
      "args": ["@yourorg/batch-upgrade-npm-packages-mcp"]
    }
  }
}
```

## Future Enhancements

1. **Batch Configuration Files**: Support for `.batch-upgrade.json` configs
2. **Webhook Integration**: Notify external systems of PR creation
3. **Custom PR Templates**: Repository-specific PR descriptions
4. **Rollback Support**: Automated rollback if tests fail
5. **Metrics Collection**: Track upgrade success rates and patterns