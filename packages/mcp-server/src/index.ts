#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { spawn } from 'child_process';
import { z } from 'zod';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

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

    // Find the CLI package's batch-upgrade-npm-pkgs.sh script
    const cliPackagePath = require.resolve('batch-upgrade-npm-packages/package.json');
    const cliDir = dirname(cliPackagePath);
    const scriptPath = join(cliDir, 'batch-upgrade-npm-pkgs.sh');

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