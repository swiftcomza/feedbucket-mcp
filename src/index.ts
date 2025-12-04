#!/usr/bin/env node
/**
 * Purpose: MCP server implementation for Feedbucket API integration
 * Dependencies: @modelcontextprotocol/sdk
 * 
 * Example Input:
 * ```
 * MCP tool call: { name: "webhook_list", arguments: { summary: true, limit: 10 } }
 * ```
 * 
 * Expected Output:
 * ```
 * { feedback: [{ id: 326247, title: "Bug report", summary: "..." }] }
 * ```
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { getConfig } from './config.js';
import { FeedbucketApi, FeedbucketApiError } from './api.js';
import type { ListOptions, FeedbackFilter } from './types.js';

const server = new Server(
  {
    name: 'feedbucket-collector',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

let api: FeedbucketApi;

try {
  const config = getConfig();
  api = new FeedbucketApi(config);
} catch (error) {
  console.error('Failed to initialize Feedbucket API:', error);
  process.exit(1);
}

const tools: Tool[] = [
  {
    name: 'feedback_list',
    description: 'Fetch all feedback items from the Feedbucket project with intelligent filtering for AI consumption. Automatically optimizes data to prevent overwhelming responses.',
    inputSchema: {
      type: 'object',
      properties: {
        resolved: {
          type: 'boolean',
          description: 'Filter by resolution status (true for resolved, false for unresolved)'
        },
        limit: {
          type: 'number',
          description: 'Number of feedback items to retrieve (default: 10, max: 50 for AI optimization)',
          minimum: 1,
          maximum: 50
        },
        offset: {
          type: 'number',
          description: 'Number of feedback items to skip for pagination (default: 0)',
          minimum: 0
        },
        summary: {
          type: 'boolean',
          description: 'Return condensed summary format optimized for AI analysis (default: true, recommended)'
        },
        page_filter: {
          type: 'string',
          description: 'Filter by page URL (partial match supported)'
        },
        reporter_filter: {
          type: 'string',
          description: 'Filter by reporter name (partial match supported)'
        },
        feedback_type: {
          type: 'string',
          enum: ['screenshot', 'video', 'text'],
          description: 'Filter by feedback type (screenshot, video, or text)'
        },
        created_after: {
          type: 'string',
          description: 'Filter feedback created after this ISO date (e.g., 2025-01-01T00:00:00Z)'
        }
      }
    }
  },
  {
    name: 'feedback_comment',
    description: 'Add a comment to a specific feedback item to ask for clarification or provide updates',
    inputSchema: {
      type: 'object',
      properties: {
        feedback_id: {
          type: 'number',
          description: 'The feedback ID to comment on'
        },
        comment: {
          type: 'string',
          description: 'The comment text to add'
        },
        reporter_name: {
          type: 'string',
          description: 'Name to use for the comment (optional, defaults to "Claude AI Assistant")'
        },
        reporter_email: {
          type: 'string',
          description: 'Email to use for the comment (optional, defaults to "claude@anthropic.com")'
        },
        resolve: {
          type: 'boolean',
          description: 'Whether this comment resolves the feedback (optional, defaults to false)'
        }
      },
      required: ['feedback_id', 'comment']
    }
  },
  {
    name: 'feedback_resolve',
    description: 'Mark a feedback item as resolved after actioning it',
    inputSchema: {
      type: 'object',
      properties: {
        feedback_id: {
          type: 'number',
          description: 'The feedback ID to mark as resolved'
        }
      },
      required: ['feedback_id']
    }
  },
  {
    name: 'feedback_get',
    description: 'Get full details of a specific feedback item including all comments, attachments, and session data',
    inputSchema: {
      type: 'object',
      properties: {
        feedback_id: {
          type: 'number',
          description: 'The feedback ID to retrieve'
        }
      },
      required: ['feedback_id']
    }
  },
  {
    name: 'feedback_stats',
    description: 'Get a quick summary of project feedback statistics - total count, resolved/unresolved breakdown, feedback by type, and recent activity',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'api_status',
    description: 'Check Feedbucket API connection status and configuration',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  }
];

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  try {
    switch (name) {
      case 'feedback_list': {
        const requestedLimit = (args?.limit as number) || 10;
        const aiOptimizedLimit = Math.min(requestedLimit, 50);
        
        const filter: FeedbackFilter = {};
        
        if (args?.resolved !== undefined) {
          filter.resolved = args.resolved as boolean;
        }
        
        if (args?.page_filter) {
          filter.page = args.page_filter as string;
        }
        
        if (args?.reporter_filter) {
          filter.reporter = args.reporter_filter as string;
        }
        
        if (args?.feedback_type) {
          filter.type = args.feedback_type as "screenshot" | "video" | "text";
        }
        
        if (args?.created_after) {
          filter.created_after = args.created_after as string;
        }
        
        const options: ListOptions & { filter?: FeedbackFilter } = {
          limit: aiOptimizedLimit,
          offset: (args?.offset as number) || 0,
          summary: (args?.summary as boolean) !== false
        };
        
        if (Object.keys(filter).length > 0) {
          options.filter = filter;
        }
        
        const result = await api.getProjectFeedback(options);
        
        const responseData = {
          project: result.project.name,
          data_stats: result.data_optimization,
          feedback: result.feedback,
          pagination: {
            showing: result.feedback.length,
            total_available: result.total_count,
            offset: options.offset,
            limit: options.limit,
            has_more: (options.offset || 0) + result.feedback.length < result.total_count
          },
          ai_optimization: {
            summary_mode: options.summary,
            limit_applied: requestedLimit !== aiOptimizedLimit,
            original_limit_requested: requestedLimit,
            ai_optimized_limit: aiOptimizedLimit,
            filter_applied: !!options.filter
          }
        };
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(responseData, null, 2)
            }
          ]
        };
      }
      
      case 'feedback_comment': {
        if (!args?.feedback_id) {
          throw new Error('feedback_id parameter is required');
        }
        
        if (!args?.comment) {
          throw new Error('comment parameter is required');
        }
        
        const feedbackId = args.feedback_id as number;
        const commentText = args.comment as string;
        const reporterName = args?.reporter_name as string | undefined;
        const reporterEmail = args?.reporter_email as string | undefined;
        const resolve = args?.resolve as boolean | undefined;
        
        const result = await api.addComment(feedbackId, commentText, reporterName, reporterEmail, resolve);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                message: result.message,
                comment: {
                  id: result.comment.id,
                  body: result.comment.body,
                  name: result.comment.name,
                  created_at: result.comment.created_at
                },
                feedback_id: feedbackId
              }, null, 2)
            }
          ]
        };
      }
      
      case 'feedback_resolve': {
        if (!args?.feedback_id) {
          throw new Error('feedback_id parameter is required');
        }
        
        const feedbackId = args.feedback_id as number;
        
        const result = await api.resolveFeedback(feedbackId);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                message: result.message,
                feedback_id: result.feedback.id,
                title: result.feedback.title,
                resolved_at: result.feedback.resolved_at,
                reporter: result.feedback.reporter.name
              }, null, 2)
            }
          ]
        };
      }
      
      case 'feedback_get': {
        if (!args?.feedback_id) {
          throw new Error('feedback_id parameter is required');
        }

        const feedbackId = args.feedback_id as number;
        const feedback = await api.getFeedbackById(feedbackId);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                id: feedback.id,
                type: feedback.type,
                title: feedback.title,
                text: feedback.text,
                reporter: {
                  name: feedback.reporter.name,
                  email: feedback.reporter.email
                },
                page: feedback.session_data.page,
                device: feedback.session_data.device,
                browser: feedback.session_data.browser,
                system: feedback.session_data.system,
                screen: {
                  width: feedback.session_data.screenWidth,
                  height: feedback.session_data.screenHeight,
                  viewport_width: feedback.session_data.viewportWidth,
                  viewport_height: feedback.session_data.viewportHeight
                },
                resource: feedback.resource,
                attachments: feedback.attachments,
                tags: feedback.tags,
                created_at: feedback.created_at,
                resolved_at: feedback.resolved_at,
                comments: feedback.comments.map(c => ({
                  id: c.id,
                  body: c.body,
                  name: c.name,
                  created_at: c.created_at
                })),
                console_logs: feedback.session_data.devDataOverview
              }, null, 2)
            }
          ]
        };
      }

      case 'feedback_stats': {
        const result = await api.getProjectFeedback({ summary: true });
        const allFeedback = await api.getProjectFeedback({ summary: false });
        const feedbackList = allFeedback.feedback as readonly import('./types.js').Feedback[];

        const stats = {
          project: result.project.name,
          total_feedback: result.data_optimization.original_count,
          resolved: feedbackList.filter(f => f.resolved_at !== null).length,
          unresolved: feedbackList.filter(f => f.resolved_at === null).length,
          by_type: {
            screenshot: feedbackList.filter(f => f.type === 'screenshot').length,
            video: feedbackList.filter(f => f.type === 'video').length,
            text: feedbackList.filter(f => f.type === 'text').length
          },
          recent_activity: {
            last_7_days: feedbackList.filter(f => {
              const created = new Date(f.created_at);
              const weekAgo = new Date();
              weekAgo.setDate(weekAgo.getDate() - 7);
              return created > weekAgo;
            }).length,
            last_30_days: feedbackList.filter(f => {
              const created = new Date(f.created_at);
              const monthAgo = new Date();
              monthAgo.setDate(monthAgo.getDate() - 30);
              return created > monthAgo;
            }).length
          },
          top_pages: Object.entries(
            feedbackList.reduce((acc, f) => {
              const page = f.session_data.page;
              acc[page] = (acc[page] || 0) + 1;
              return acc;
            }, {} as Record<string, number>)
          )
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([page, count]) => ({ page, count }))
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(stats, null, 2)
            }
          ]
        };
      }

      case 'api_status': {
        const status = await api.getStatus();

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(status, null, 2)
            }
          ]
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof FeedbucketApiError 
      ? `API Error (${error.status}): ${error.message}`
      : error instanceof Error 
        ? error.message 
        : 'Unknown error occurred';
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ error: errorMessage }, null, 2)
        }
      ],
      isError: true
    };
  }
});

async function runServer(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runServer().catch((error) => {
    console.error('Server failed to start:', error);
    process.exit(1);
  });
}

export { server, runServer };