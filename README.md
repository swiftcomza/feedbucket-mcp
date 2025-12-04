# Feedbucket MCP Server

A Model Context Protocol (MCP) server that lets AI assistants (Claude Code, Cursor) manage website feedback from [Feedbucket](https://feedbucket.app).

## Quick Start

### Option 1: Install from npm (recommended)

```bash
npm install -g feedbucket-mcp
```

Then run setup:

```bash
# For protected projects:
feedbucket-setup https://your-website.com YOUR_FEEDBUCKET_SECRET

# For public projects:
feedbucket-setup https://your-website.com
```

### Option 2: Clone from GitHub

```bash
git clone https://github.com/swiftcomza/feedbucket-mcp.git
cd feedbucket-mcp
npm install && npm run build
npm run setup -- https://your-website.com YOUR_FEEDBUCKET_SECRET
```

The setup script automatically:
- Extracts the project ID from your website HTML
- Fetches the private key from Feedbucket API
- Configures Claude Code and Cursor

### Restart your IDE

Restart Claude Code or Cursor to load the new MCP server.

### Start using it

Ask your AI assistant:
- "Show me unresolved feedback from Feedbucket"
- "What's the feedback summary for this project?"
- "Add a comment to feedback #12345 saying we've fixed this"

---

## Available Tools

| Tool | Description |
|------|-------------|
| `feedback_list` | List and filter feedback with smart summarization |
| `feedback_get` | Get full details of a specific feedback item |
| `feedback_stats` | Quick project overview (total, resolved, by type, recent activity) |
| `feedback_comment` | Add comments to feedback items |
| `feedback_resolve` | Mark feedback as resolved |
| `api_status` | Check API connection status |

### feedback_list

List feedback with powerful filtering:

```
Parameters:
- resolved (boolean): Filter by resolution status
- limit (number): Items to retrieve (default: 10, max: 50)
- offset (number): Skip items for pagination
- summary (boolean): Return condensed format (default: true)
- page_filter (string): Filter by page URL (partial match)
- reporter_filter (string): Filter by reporter name
- feedback_type (string): 'screenshot', 'video', or 'text'
- created_after (string): ISO date filter
```

### feedback_get

Get complete details for a single feedback item:

```
Parameters:
- feedback_id (number, required): The feedback ID
```

Returns full text, all comments, attachments, browser/device info, and console logs.

### feedback_stats

Get a quick project health overview:

```
Returns:
- Total feedback count
- Resolved vs unresolved breakdown
- Feedback by type (screenshot/video/text)
- Recent activity (7 days, 30 days)
- Top 5 pages with most feedback
```

### feedback_comment

Add a comment to a feedback item:

```
Parameters:
- feedback_id (number, required): The feedback ID
- comment (string, required): Comment text
- reporter_name (string): Defaults to "Claude AI Assistant"
- reporter_email (string): Defaults to "claude@anthropic.com"
- resolve (boolean): Also resolve the feedback (default: false)
```

### feedback_resolve

Mark a feedback item as resolved:

```
Parameters:
- feedback_id (number, required): The feedback ID
```

---

## Setup Options

### Automatic Setup (recommended)

```bash
# Protected project - provide URL and secret
npm run setup -- https://your-website.com YOUR_SECRET

# Public project - just the URL
npm run setup -- https://your-website.com
```

### Manual Project ID (if auto-detection fails)

```bash
# With project ID only (public)
npm run setup -- --project-id tMbUCuQ4FeFJVViMEPlb

# With project ID and API key (protected)
npm run setup -- --project-id tMbUCuQ4FeFJVViMEPlb --api-key YOUR_SECRET
```

### Configure only one IDE

```bash
# Claude Code only
npm run setup -- https://your-website.com YOUR_SECRET --claude

# Cursor only
npm run setup -- https://your-website.com YOUR_SECRET --cursor
```

### Extract credentials without configuring

```bash
npm run setup -- https://your-website.com YOUR_SECRET --extract
```

### Full help

```bash
npm run setup -- --help
```

---

## Manual Configuration

If you prefer to configure manually:

### Claude Code

Add to `.mcp.json` in your project root:

```json
{
  "mcpServers": {
    "feedbucket": {
      "command": "node",
      "args": ["/path/to/feedbucket-mcp/dist/index.js"],
      "env": {
        "FEEDBUCKET_PROJECT_ID": "your-project-id",
        "FEEDBUCKET_PRIVATE_KEY": "your-private-key",
        "FEEDBUCKET_API_KEY": "your-api-key"
      }
    }
  }
}
```

Or use the CLI:

```bash
claude mcp add feedbucket \
  -e FEEDBUCKET_PROJECT_ID="your-project-id" \
  -e FEEDBUCKET_PRIVATE_KEY="your-private-key" \
  -e FEEDBUCKET_API_KEY="your-api-key" \
  -- node /path/to/feedbucket-mcp/dist/index.js
```

### Cursor

Add to `.cursor/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "feedbucket": {
      "command": "node",
      "args": ["/path/to/feedbucket-mcp/dist/index.js"],
      "env": {
        "FEEDBUCKET_PROJECT_ID": "your-project-id",
        "FEEDBUCKET_PRIVATE_KEY": "your-private-key",
        "FEEDBUCKET_API_KEY": "your-api-key"
      }
    }
  }
}
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `FEEDBUCKET_PROJECT_ID` | Yes | Project ID from the `data-feedbucket` attribute |
| `FEEDBUCKET_PRIVATE_KEY` | Yes | Private key for commenting/resolving (auto-fetched by setup) |
| `FEEDBUCKET_API_KEY` | No* | API key for protected projects (`feedbucketKey` from URL) |

*Required if your project uses query string protection.

---

## Finding Your feedbucketKey

For protected projects, your `feedbucketKey` is the secret you set in Feedbucket's "Trigger by query string" setting.

1. Go to [Widget Settings](https://dashboard.feedbucket.app/projects/YOUR_PROJECT_ID/settings/widget) in your Feedbucket Dashboard
2. Set "Trigger Feedbucket using a query string" to **Yes**
3. Save settings and copy your secret key
4. Pass it as the second argument: `npm run setup -- https://yoursite.com YOUR_SECRET`

The setup script automatically extracts the project ID from your website and fetches the private key from the API.

---

## Development

```bash
# Install dependencies
npm install

# Development mode (with hot reload)
npm run dev

# Type checking
npm run typecheck

# Linting
npm run lint

# Build for production
npm run build
```

---

## Architecture

This MCP server was reverse-engineered from the Feedbucket browser widget to provide:

- **Smart Summarization**: Optimizes large datasets for AI consumption
- **Client-side Filtering**: Reduces API calls by filtering locally
- **Full TypeScript**: Strict mode with comprehensive types
- **Production Ready**: Proper error handling and validation

### API Endpoints Used

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/projects/{id}` | Fetch project with all feedback |
| POST | `/feedback/{id}/comments` | Add comment to feedback |
| PUT | `/feedback/{id}/resolve` | Mark feedback as resolved |

---

## License

MIT
