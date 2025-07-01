# Simplified Implementation Plan: MCP Server for batch-upgrade-npm-packages

## Overview
Instead of recreating the logic, we'll create a thin MCP wrapper around the existing bash script. The MCP server will:
1. Accept tool inputs from the AI model
2. Pass them to the bash script via stdin
3. Parse the script output and return structured results

## Step 1: Project Setup (30 minutes)

### 1.1 Initialize Project
```bash
npm init -y
npm install @modelcontextprotocol/sdk zod
npm install --save-dev typescript @types/node tsx
```

### 1.2 Configure TypeScript
Create `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 1.3 Update package.json
```json
{
  "name": "batch-upgrade-npm-packages-mcp",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "bin": {
    "batch-upgrade-mcp": "dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/index.ts"
  },
  "files": [
    "dist/",
    "batch-upgrade-npm-pkgs.sh"
  ]
}
```

## Step 2: Simple MCP Server Implementation (1 hour)

### 2.1 Create Main Server File
`src/index.ts`:
```typescript
#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Input validation schema
const UpgradePackagesSchema = z.object({
  packages: z.array(z.string()).min(1),
  versions: z.array(z.string()).min(1),
  repositories: z.array(z.string()).min(1)
});

// Create server
const server = new Server(
  {
    name: 'batch-upgrade-npm-packages',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'upgrade-npm-packages',
        description: 'Upgrades npm packages across multiple repositories by creating pull requests',
        inputSchema: {
          type: 'object',
          properties: {
            packages: {
              type: 'array',
              items: { type: 'string' },
              description: 'Package names to upgrade (e.g., ["@org/pkg1", "lodash"])'
            },
            versions: {
              type: 'array',
              items: { type: 'string' },
              description: 'Target versions matching package order (e.g., ["^1.2.0", "^4.17.21"])'
            },
            repositories: {
              type: 'array',
              items: { type: 'string' },
              description: 'Repository paths relative to working directory'
            }
          },
          required: ['packages', 'versions', 'repositories']
        }
      }
    ]
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== 'upgrade-npm-packages') {
    throw new Error(`Unknown tool: ${request.params.name}`);
  }

  try {
    // Validate input
    const input = UpgradePackagesSchema.parse(request.params.arguments);
    
    if (input.packages.length !== input.versions.length) {
      throw new Error('Number of packages and versions must match');
    }

    // Path to the bash script
    const scriptPath = join(__dirname, '..', 'batch-upgrade-npm-pkgs.sh');

    // Execute the script
    const result = await new Promise<string>((resolve, reject) => {
      const process = spawn('bash', [scriptPath], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      let errorOutput = '';

      // Send input to the script
      process.stdin.write(input.packages.join(' ') + '\n');
      process.stdin.write(input.versions.join(' ') + '\n');
      process.stdin.write(input.repositories.join(' ') + '\n');
      process.stdin.end();

      process.stdout.on('data', (data) => {
        output += data.toString();
        // Send progress updates
        server.notification({
          method: 'tools/progress',
          params: {
            toolName: 'upgrade-npm-packages',
            progress: data.toString()
          }
        });
      });

      process.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`Script failed with exit code ${code}: ${errorOutput}`));
        }
      });

      process.on('error', (err) => {
        reject(err);
      });
    });

    // Parse the output to extract PR URLs
    const prUrls = result.match(/Pull request created.*?(https:\/\/github\.com\/[^\s]+)/g) || [];
    const successfulRepos = prUrls.map(match => {
      const url = match.match(/https:\/\/github\.com\/[^\s]+/)?.[0];
      return url;
    }).filter(Boolean);

    // Format the response
    const summary = {
      totalRepositories: input.repositories.length,
      successfulPRs: successfulRepos.length,
      prUrls: successfulRepos
    };

    return {
      content: [
        {
          type: 'text',
          text: `Successfully processed ${summary.successfulPRs} out of ${summary.totalRepositories} repositories.\n\nPull Request URLs:\n${summary.prUrls.join('\n')}\n\nFull output:\n${result}`
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      ],
      isError: true
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('MCP server for batch-upgrade-npm-packages started');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
```

## Step 3: Test the Implementation (30 minutes)

### 3.1 Build the Project
```bash
npm run build
```

### 3.2 Test Locally
Create a test script `test.js`:
```javascript
import { spawn } from 'child_process';

const child = spawn('node', ['dist/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

// Send a list tools request
child.stdin.write(JSON.stringify({
  jsonrpc: '2.0',
  method: 'tools/list',
  id: 1
}) + '\n');

// Handle responses
child.stdout.on('data', (data) => {
  console.log('Response:', data.toString());
});
```

## Step 4: Package for NPM (30 minutes)

### 4.1 Add README.md
```markdown
# batch-upgrade-npm-packages MCP Server

An MCP server that wraps the batch-upgrade-npm-packages script to enable AI models to upgrade npm packages across multiple repositories.

## Installation

```bash
npm install -g batch-upgrade-npm-packages-mcp
```

## Usage with Claude Desktop

Add to your Claude Desktop configuration file:

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

## Prerequisites

- Git installed and configured
- GitHub CLI (`gh`) installed and authenticated
- npm installed
- Access to the repositories you want to update

## How It Works

The MCP server provides a single tool called `upgrade-npm-packages` that:
1. Takes arrays of packages, versions, and repository paths
2. Runs the batch upgrade script for each repository
3. Creates pull requests with the changes
4. Returns the PR URLs

## Example Usage

When talking to Claude, you can say:
"Please upgrade @myorg/package1 to ^2.0.0 and lodash to ^4.17.21 in repositories repo1 and repo2"

Claude will use the tool to create pull requests for each repository with the specified package updates.
```

### 4.2 Add .npmignore
```
src/
test/
*.ts
tsconfig.json
.gitignore
```

### 4.3 Update package.json for Publishing
```json
{
  "name": "batch-upgrade-npm-packages-mcp",
  "version": "1.0.0",
  "description": "MCP server for batch upgrading npm packages across repositories",
  "keywords": ["mcp", "npm", "upgrade", "automation", "github"],
  "author": "Your Name",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/yourusername/batch-upgrade-npm-packages"
  },
  "publishConfig": {
    "access": "public"
  }
}
```

## Step 5: Publish to NPM (15 minutes)

### 5.1 Test the Package Locally
```bash
npm link
# In another directory
npm link batch-upgrade-npm-packages-mcp
```

### 5.2 Publish
```bash
npm login
npm publish
```

## Total Implementation Time: ~3 hours

This simplified approach:
- ✅ Reuses all existing bash script logic
- ✅ Minimal code to maintain
- ✅ Easy to understand and debug
- ✅ Preserves all safety features of the original script
- ✅ Works with the script's interactive prompts

The key insight is that we don't need to reimplement anything - just create a thin wrapper that:
1. Exposes the tool to MCP
2. Passes inputs to the script via stdin
3. Captures and formats the output

This is much simpler than the previous approach and leverages all the work already done in the bash script!