/**
 * Purpose: Bundle script with environment variable injection for Claude Code deployment
 * Dependencies: esbuild
 * 
 * Example Input:
 * ```
 * FEEDBUCKET_PROJECT_KEY=S3q9juJHLaa1f7U3kBAx npm run build
 * ```
 * 
 * Expected Output:
 * ```
 * dist/feedbucket-mcp-bundled.js with injected environment variables
 * ```
 */

import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

// Environment variables are now read at runtime, not bundled at build time
// No longer need to validate environment variables during build

function createBundledVersion() {
  // Create a generic bundle that reads environment variables at runtime
  return build({
    entryPoints: ['src/index.ts'],
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'esm',
    outfile: 'dist/feedbucket-mcp-bundled.js',
    external: [],
    // Remove define: envVars - no longer injecting environment variables at build time
    minify: false,
    sourcemap: true,
    banner: {
      js: '#!/usr/bin/env node'
    }
  });
}

async function createManifest() {
  const manifestContent = {
    name: 'feedbucket-collector',
    version: '1.0.0',
    description: 'MCP server for Feedbucket API integration',
    main: './feedbucket-mcp-bundled.js',
    runtime: 'node',
    tools: [
      {
        name: 'feedback_list',
        description: 'Fetch all feedback items with intelligent filtering for AI consumption'
      },
      {
        name: 'feedback_comment', 
        description: 'Add a comment to a specific feedback item'
      },
      {
        name: 'feedback_resolve',
        description: 'Mark a feedback item as resolved after actioning'
      },
      {
        name: 'api_status',
        description: 'Check Feedbucket API connection status and configuration'
      }
    ]
  };
  
  writeFileSync(
    'dist/manifest.json',
    JSON.stringify(manifestContent, null, 2)
  );
  
  console.log('✅ Created manifest.json');
}

async function createReadme() {
  const readmeContent = `# Feedbucket MCP Server

This is a generic bundled MCP server for Feedbucket API integration that reads configuration at runtime.

## Usage in Claude Code

### Per-Project Configuration (Recommended)

In each project directory, add the MCP server with project-specific environment variables:

\`\`\`bash
claude mcp add feedbucket-collector -s project \\
  -e FEEDBUCKET_PROJECT_KEY=your-project-key \\
  -e FEEDBUCKET_API_KEY=your-api-key \\
  ./path/to/feedbucket-mcp-bundled.js
\`\`\`

This creates a \`.mcp.json\` file in your project with the configuration.

### User-Scope Configuration

For global access across all projects:

\`\`\`bash
claude mcp add feedbucket-collector -s user \\
  -e FEEDBUCKET_PROJECT_KEY=your-project-key \\
  -e FEEDBUCKET_API_KEY=your-api-key \\
  ./path/to/feedbucket-mcp-bundled.js
\`\`\`

## Available Tools

- \`feedback_list\`: List feedback items with filtering and summarization
- \`feedback_comment\`: Add comments to feedback items
- \`feedback_resolve\`: Mark feedback as resolved
- \`api_status\`: Check API connection status

## Required Environment Variables

The following environment variables must be provided when adding the MCP server:

- **FEEDBUCKET_PROJECT_KEY**: Your Feedbucket project key
- **FEEDBUCKET_API_KEY**: Your Feedbucket API key
- **FEEDBUCKET_BASE_URL**: API base URL (optional, defaults to https://dashboard.feedbucket.app/api/v1)

## Multi-Project Support

This version supports multiple projects by reading environment variables at runtime. Each project can have its own MCP configuration with different project keys and API keys.

Generated: ${new Date().toISOString()}
`;
  
  writeFileSync('dist/README.md', readmeContent);
  console.log('✅ Created README.md');
}

async function main() {
  console.log('🚀 Building generic Feedbucket MCP server bundle...');
  console.log('📋 Environment variables will be read at runtime, not bundled');
  
  try {
    await createBundledVersion();
    console.log('✅ Generic bundle created successfully');
    
    await createManifest();
    await createReadme();
    
    console.log('🎉 Build completed successfully!');
    console.log('📦 Bundle location: dist/feedbucket-mcp-bundled.js');
    console.log('💡 Use "claude mcp add" with -e flags to configure environment variables');
    
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}