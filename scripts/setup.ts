#!/usr/bin/env npx tsx
/**
 * Purpose: Auto-setup script for Feedbucket MCP
 * Extracts credentials from a website with Feedbucket installed and configures Claude Code/Cursor
 *
 * Usage:
 *   npx tsx scripts/setup.ts https://your-website.com
 *   npx tsx scripts/setup.ts --project-id ABC123
 *   npx tsx scripts/setup.ts --help
 *
 * What it does:
 * 1. Extracts the Feedbucket project ID (from URL, HTML, or user input)
 * 2. Fetches the project data to get the private key
 * 3. Configures the MCP for Claude Code and/or Cursor
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

interface FeedbucketCredentials {
  projectId: string;
  privateKey: string;
  apiKey?: string;
  projectName: string;
  websiteUrl: string;
}

interface FeedbucketApiResponse {
  message: string;
  project: {
    id: number;
    name: string;
    url: string;
    private_key: string;
    feedback: unknown[];
    settings: unknown;
  };
}

const FEEDBUCKET_API_BASE = 'https://dashboard.feedbucket.app/api/v1';

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset'): void {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step: number, message: string): void {
  log(`\n[${step}] ${message}`, 'cyan');
}

function logSuccess(message: string): void {
  log(`✓ ${message}`, 'green');
}

function logError(message: string): void {
  log(`✗ ${message}`, 'red');
}

function logWarning(message: string): void {
  log(`⚠ ${message}`, 'yellow');
}

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function showHelp(): void {
  console.log(`
${colors.bright}Feedbucket MCP Setup${colors.reset}

Automatically configure Feedbucket MCP for Claude Code or Cursor.

${colors.cyan}Usage:${colors.reset}
  npm run setup -- <website-url> <feedbucket-secret>
  npm run setup -- <website-url>  (for public projects)
  npm run setup  (interactive mode)

${colors.cyan}Arguments:${colors.reset}
  website-url        Your website URL (e.g., https://example.com)
  feedbucket-secret  Your Feedbucket query string secret

${colors.cyan}Options:${colors.reset}
  --help, -h         Show this help message
  --extract          Only extract credentials, don't configure MCP
  --claude           Configure for Claude Code only
  --cursor           Configure for Cursor only
  --both             Configure for both Claude Code and Cursor (default)

${colors.cyan}Examples:${colors.reset}
  npm run setup -- https://mysite.com abc123secret
  npm run setup -- https://mysite.com/en/ abc123secret
  npm run setup -- https://mysite.com  (public project)
  npm run setup  (interactive prompts)

${colors.cyan}How it works:${colors.reset}
  1. Fetches your website to find the Feedbucket project ID
  2. Uses your secret to authenticate with Feedbucket API
  3. Retrieves all necessary credentials automatically
  4. Configures Claude Code and/or Cursor

${colors.cyan}Where to find your Feedbucket secret:${colors.reset}
  1. Go to Feedbucket Dashboard → Project Settings → Widget Settings
  2. Enable "Trigger Feedbucket using a query string"
  3. Copy your secret key
`);
}

async function fetchWebsiteFeedbucketData(websiteUrl: string): Promise<{ projectId: string; apiKey?: string }> {
  log(`Fetching ${websiteUrl}...`);

  const response = await fetch(websiteUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch website: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();

  // Check if URL has feedbucketKey parameter (protected project)
  const url = new URL(websiteUrl);
  const apiKey = url.searchParams.get('feedbucketKey') ?? undefined;

  // Try multiple patterns to find the project ID

  // Pattern 1: data-feedbucket with various quote styles
  // Handles: data-feedbucket="X", data-feedbucket":"X", data-feedbucket\":\"X\" (JSON escaped)
  let projectIdMatch = html.match(/data-feedbucket\\?["']?\\?:\s*\\?["']?([a-zA-Z0-9]{15,25})\\?["']?/);

  // Pattern 2: IIFE loader pattern - })('projectId') or })("projectId")
  if (!projectIdMatch) {
    projectIdMatch = html.match(/feedbucket\.js[\s\S]{0,300}?\}\s*\)\s*\(\s*['"]([a-zA-Z0-9]{15,25})['"]\s*\)/);
  }

  // Pattern 3: s.dataset.feedbucket=k followed by key
  if (!projectIdMatch) {
    projectIdMatch = html.match(/dataset\.feedbucket\s*=\s*k[\s\S]{0,100}?\(['"]([a-zA-Z0-9]{15,25})['"]\)/);
  }

  // Pattern 4: Direct script src with project ID as query param
  if (!projectIdMatch) {
    projectIdMatch = html.match(/feedbucket\.js\?.*?(?:id|project|key)=([a-zA-Z0-9]{15,25})/);
  }

  // Pattern 5: Any quoted string near "feedbucket" that looks like a project ID (20 chars alphanumeric)
  if (!projectIdMatch) {
    projectIdMatch = html.match(/feedbucket[\s\S]{0,150}?["']([a-zA-Z0-9]{20})["']/);
  }

  if (projectIdMatch) {
    logSuccess(`Found project ID in page HTML`);
    return { projectId: projectIdMatch[1], apiKey };
  }

  // If not found in HTML, it's likely loaded dynamically (Next.js, etc.)
  throw new Error('DYNAMIC_LOADING');
}

async function fetchFeedbucketCredentials(projectId: string, apiKey?: string): Promise<FeedbucketCredentials> {
  let endpoint = `${FEEDBUCKET_API_BASE}/projects/${projectId}`;
  if (apiKey) {
    endpoint += `?feedbucketKey=${apiKey}`;
  }

  log(`Fetching project data from Feedbucket API...`);

  const response = await fetch(endpoint, {
    headers: {
      'Accept': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
  });

  if (!response.ok) {
    if (response.status === 403 || response.status === 401) {
      throw new Error(
        'This project requires authentication. Please provide the API key:\n' +
        '  npx tsx scripts/setup.ts --project-id ' + projectId + ' --api-key YOUR_KEY'
      );
    }
    if (response.status === 404) {
      throw new Error(`Project not found: ${projectId}. Please check the project ID.`);
    }
    throw new Error(`Feedbucket API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as FeedbucketApiResponse;

  // Check if project is protected (returns empty response without API key)
  if (!data.project) {
    throw new Error(
      'This project is protected and requires an API key (feedbucketKey).\n\n' +
      'To get your API key:\n' +
      '  1. Open your website with ?feedbucketKey=YOUR_SECRET in the URL\n' +
      '  2. The feedbucketKey value is your API key\n\n' +
      'Then run:\n' +
      `  npx tsx scripts/setup.ts --project-id ${projectId} --api-key YOUR_KEY`
    );
  }

  if (!data.project.private_key) {
    throw new Error('Could not retrieve private key from Feedbucket API. The project may have restricted access.');
  }

  return {
    projectId,
    privateKey: data.project.private_key,
    apiKey,
    projectName: data.project.name,
    websiteUrl: data.project.url,
  };
}

function getClaudeConfigPath(scope: 'project' | 'user'): string {
  if (scope === 'project') {
    return join(process.cwd(), '.mcp.json');
  }
  // User scope - Claude Code stores config in ~/.claude/
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';
  return join(homeDir, '.claude', 'mcp.json');
}

function getCursorConfigPath(): string {
  // Cursor stores MCP config in .cursor/mcp.json at project level
  return join(process.cwd(), '.cursor', 'mcp.json');
}

interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

interface McpConfig {
  mcpServers?: Record<string, McpServerConfig>;
}

function configureClaudeCode(credentials: FeedbucketCredentials, scope: 'project' | 'user'): void {
  const configPath = getClaudeConfigPath(scope);
  const configDir = dirname(configPath);

  // Ensure directory exists
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  // Read existing config or create new
  let config: McpConfig = {};
  if (existsSync(configPath)) {
    try {
      config = JSON.parse(readFileSync(configPath, 'utf-8')) as McpConfig;
    } catch {
      logWarning(`Could not parse existing config at ${configPath}, creating new one`);
    }
  }

  // Initialize mcpServers if needed
  if (!config.mcpServers) {
    config.mcpServers = {};
  }

  // Create a safe server name from project name
  const serverName = `feedbucket-${credentials.projectName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')}`;

  // Build the MCP server config
  const serverConfig: McpServerConfig = {
    command: 'node',
    args: [join(projectRoot, 'dist', 'index.js')],
    env: {
      FEEDBUCKET_PROJECT_ID: credentials.projectId,
      FEEDBUCKET_PRIVATE_KEY: credentials.privateKey,
    },
  };

  if (credentials.apiKey) {
    serverConfig.env!.FEEDBUCKET_API_KEY = credentials.apiKey;
  }

  config.mcpServers[serverName] = serverConfig;

  // Write config
  writeFileSync(configPath, JSON.stringify(config, null, 2));
  logSuccess(`Claude Code configured at ${configPath}`);
  log(`  Server name: ${serverName}`);
}

function configureCursor(credentials: FeedbucketCredentials): void {
  const configPath = getCursorConfigPath();
  const configDir = dirname(configPath);

  // Ensure directory exists
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  // Read existing config or create new
  let config: McpConfig = {};
  if (existsSync(configPath)) {
    try {
      config = JSON.parse(readFileSync(configPath, 'utf-8')) as McpConfig;
    } catch {
      logWarning(`Could not parse existing config at ${configPath}, creating new one`);
    }
  }

  // Initialize mcpServers if needed
  if (!config.mcpServers) {
    config.mcpServers = {};
  }

  // Create a safe server name from project name
  const serverName = `feedbucket-${credentials.projectName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')}`;

  // Build the MCP server config
  const serverConfig: McpServerConfig = {
    command: 'node',
    args: [join(projectRoot, 'dist', 'index.js')],
    env: {
      FEEDBUCKET_PROJECT_ID: credentials.projectId,
      FEEDBUCKET_PRIVATE_KEY: credentials.privateKey,
    },
  };

  if (credentials.apiKey) {
    serverConfig.env!.FEEDBUCKET_API_KEY = credentials.apiKey;
  }

  config.mcpServers[serverName] = serverConfig;

  // Write config
  writeFileSync(configPath, JSON.stringify(config, null, 2));
  logSuccess(`Cursor configured at ${configPath}`);
  log(`  Server name: ${serverName}`);
}

function ensureBuilt(): boolean {
  const distPath = join(projectRoot, 'dist', 'index.js');
  if (!existsSync(distPath)) {
    logWarning('MCP server not built yet. Building now...');
    try {
      execSync('npm run build', { cwd: projectRoot, stdio: 'inherit' });
      return true;
    } catch {
      logError('Failed to build MCP server. Please run "npm run build" manually.');
      return false;
    }
  }
  return true;
}

interface ParsedArgs {
  websiteUrl?: string;
  feedbucketSecret?: string;
  showHelp: boolean;
  extractOnly: boolean;
  configureClaude: boolean;
  configureCursor: boolean;
  scope: 'project' | 'user';
}

function parseArgs(args: string[]): ParsedArgs {
  const result: ParsedArgs = {
    showHelp: false,
    extractOnly: false,
    configureClaude: true,
    configureCursor: true,
    scope: 'project',
  };

  const positionalArgs: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      result.showHelp = true;
    } else if (arg === '--extract') {
      result.extractOnly = true;
    } else if (arg === '--claude') {
      result.configureClaude = true;
      result.configureCursor = false;
    } else if (arg === '--cursor') {
      result.configureClaude = false;
      result.configureCursor = true;
    } else if (arg === '--both') {
      result.configureClaude = true;
      result.configureCursor = true;
    } else if (arg === '--project-scope') {
      result.scope = 'project';
    } else if (arg === '--user-scope') {
      result.scope = 'user';
    } else if (!arg.startsWith('-')) {
      positionalArgs.push(arg);
    }
  }

  // First positional arg is the website URL
  if (positionalArgs.length >= 1) {
    result.websiteUrl = positionalArgs[0];
  }

  // Second positional arg is the feedbucket secret
  if (positionalArgs.length >= 2) {
    result.feedbucketSecret = positionalArgs[1];
  }

  return result;
}

function buildUrlWithSecret(websiteUrl: string, secret?: string): string {
  // Normalize the URL
  let url: URL;
  try {
    url = new URL(websiteUrl);
  } catch {
    // Try adding https:// if missing
    url = new URL(`https://${websiteUrl}`);
  }

  // Add the feedbucketKey if provided
  if (secret) {
    url.searchParams.set('feedbucketKey', secret);
  }

  return url.toString();
}

async function interactiveMode(): Promise<{ websiteUrl: string; feedbucketSecret?: string }> {
  console.log(`
${colors.cyan}Let's set up Feedbucket MCP for your project.${colors.reset}
`);

  const websiteUrl = await prompt(`${colors.bright}Enter your website URL: ${colors.reset}`);

  if (!websiteUrl) {
    throw new Error('Website URL is required');
  }

  const secret = await prompt(`${colors.bright}Enter your Feedbucket secret (press Enter if public): ${colors.reset}`);

  return {
    websiteUrl,
    feedbucketSecret: secret || undefined,
  };
}

async function interactiveFallback(): Promise<{ projectId: string; apiKey?: string }> {
  console.log(`
${colors.yellow}Could not automatically extract the project ID from the page.${colors.reset}

To get your Project ID manually:
  1. Open your website in a browser
  2. Open DevTools (F12) → Console
  3. Run: ${colors.cyan}document.querySelector('[data-feedbucket]')?.dataset.feedbucket${colors.reset}
`);

  const projectId = await prompt(`${colors.bright}Enter your Feedbucket Project ID: ${colors.reset}`);

  if (!projectId) {
    throw new Error('Project ID is required');
  }

  return { projectId };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.showHelp) {
    showHelp();
    process.exit(0);
  }

  console.log(`
${colors.bright}╔══════════════════════════════════════╗
║     Feedbucket MCP Auto-Setup        ║
╚══════════════════════════════════════╝${colors.reset}
`);

  try {
    let websiteUrl = args.websiteUrl;
    let feedbucketSecret = args.feedbucketSecret;

    // If no args provided, enter interactive mode
    if (!websiteUrl) {
      const interactive = await interactiveMode();
      websiteUrl = interactive.websiteUrl;
      feedbucketSecret = interactive.feedbucketSecret;
    }

    // Step 1: Build URL and extract project ID
    logStep(1, 'Extracting Feedbucket project ID from website');

    const fullUrl = buildUrlWithSecret(websiteUrl, feedbucketSecret);
    log(`Fetching ${websiteUrl}...`);

    let projectId: string;
    let apiKey = feedbucketSecret;

    try {
      const websiteData = await fetchWebsiteFeedbucketData(fullUrl);
      projectId = websiteData.projectId;
      // If apiKey was in the URL already, use that
      apiKey = apiKey || websiteData.apiKey;
      logSuccess(`Found project ID: ${projectId}`);
    } catch (error) {
      if (error instanceof Error && error.message === 'DYNAMIC_LOADING') {
        // Fallback to manual entry
        const fallback = await interactiveFallback();
        projectId = fallback.projectId;
      } else {
        throw error;
      }
    }

    if (apiKey) {
      logSuccess(`Using secret: ${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`);
    } else {
      log('No secret provided - assuming public project', 'yellow');
    }

    // Step 2: Fetch credentials from Feedbucket API
    logStep(2, 'Fetching credentials from Feedbucket API');
    const credentials = await fetchFeedbucketCredentials(projectId, apiKey);
    logSuccess(`Project: ${credentials.projectName}`);
    logSuccess(`Website: ${credentials.websiteUrl}`);
    logSuccess(`Private key: ${credentials.privateKey.slice(0, 4)}...${credentials.privateKey.slice(-4)}`);

    if (args.extractOnly) {
      const serverName = `feedbucket-${credentials.projectName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')}`;
      const distPath = join(projectRoot, 'dist', 'index.js');
      const env: Record<string, string> = {
        FEEDBUCKET_PROJECT_ID: credentials.projectId,
        FEEDBUCKET_PRIVATE_KEY: credentials.privateKey,
      };
      if (credentials.apiKey) {
        env.FEEDBUCKET_API_KEY = credentials.apiKey;
      }

      const mcpConfig = {
        [serverName]: {
          command: 'node',
          args: [distPath],
          env,
        },
      };

      // Build Claude Code CLI command
      let claudeCmd = `claude mcp add ${serverName}`;
      claudeCmd += ` \\\n  -e FEEDBUCKET_PROJECT_ID="${credentials.projectId}"`;
      claudeCmd += ` \\\n  -e FEEDBUCKET_PRIVATE_KEY="${credentials.privateKey}"`;
      if (credentials.apiKey) {
        claudeCmd += ` \\\n  -e FEEDBUCKET_API_KEY="${credentials.apiKey}"`;
      }
      claudeCmd += ` \\\n  -- node "${distPath}"`;

      log('\n' + colors.bright + 'Claude Code (run this command):' + colors.reset);
      log(colors.cyan + claudeCmd + colors.reset);

      log('\n' + colors.bright + 'Cursor (add to .cursor/mcp.json):' + colors.reset);
      log(colors.cyan + JSON.stringify({ mcpServers: mcpConfig }, null, 2) + colors.reset);

      process.exit(0);
    }

    // Step 3: Ensure MCP is built
    logStep(3, 'Checking MCP server build');
    if (!ensureBuilt()) {
      process.exit(1);
    }
    logSuccess('MCP server is built');

    // Step 4: Configure IDE(s)
    logStep(4, 'Configuring MCP servers');

    if (args.configureClaude) {
      configureClaudeCode(credentials, args.scope);
    }

    if (args.configureCursor) {
      configureCursor(credentials);
    }

    // Done!
    console.log(`
${colors.green}${colors.bright}╔══════════════════════════════════════╗
║          Setup Complete!             ║
╚══════════════════════════════════════╝${colors.reset}

${colors.cyan}Next steps:${colors.reset}
  1. Restart Claude Code / Cursor to load the new MCP server
  2. Try asking: "Show me unresolved feedback from Feedbucket"

${colors.cyan}Available commands in your AI assistant:${colors.reset}
  • feedback_list    - List and filter feedback items
  • feedback_comment - Add comments to feedback
  • feedback_resolve - Mark feedback as resolved
  • api_status       - Check connection status
`);

  } catch (error) {
    logError(error instanceof Error ? error.message : 'Unknown error occurred');
    process.exit(1);
  }
}

main();
