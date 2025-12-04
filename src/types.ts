/**
 * Purpose: TypeScript type definitions for Feedbucket API structures
 * Dependencies: None
 * 
 * Example Input:
 * ```
 * { id: 326247, type: "screenshot", title: "Bug report" }
 * ```
 * 
 * Expected Output:
 * ```
 * Properly typed feedback objects with validation
 * ```
 */

export interface FeedbucketConfig {
  readonly projectId: string;
  readonly apiKey?: string;
  readonly privateKey: string;
  readonly baseUrl: string;
}

export interface Reporter {
  readonly id: number;
  readonly name: string;
  readonly email: string;
  readonly token: string | null;
  readonly notifications: boolean;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface SessionData {
  readonly page: string;
  readonly device: string;
  readonly system: string;
  readonly browser: string;
  readonly selector: {
    readonly path: string;
    readonly offset: {
      readonly x: number;
      readonly y: number;
    };
    readonly pathWithClass: string;
    readonly scrollableSelector: string | null;
  };
  readonly userAgent: string;
  readonly screenWidth: number;
  readonly screenHeight: number;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly widgetVersion: string;
  readonly devDataOverview: {
    readonly console: {
      readonly log: number;
      readonly info: number;
      readonly warn: number;
      readonly error: number;
    };
  };
  readonly devicePixelRatio: number;
}

export interface Comment {
  readonly id: number;
  readonly body: string;
  readonly attachments: readonly string[];
  readonly created_at: string;
  readonly name: string;
}

export interface Feedback {
  readonly id: number;
  readonly type: "screenshot" | "video" | "text";
  readonly reporter: Reporter;
  readonly resource: string | null;
  readonly title: string;
  readonly text: string | null;
  readonly tags: readonly string[];
  readonly attachments: readonly string[];
  readonly resolved_at: string | null;
  readonly session_data: SessionData;
  readonly created_at: string;
  readonly comments: readonly Comment[];
}

export interface Project {
  readonly id: number;
  readonly name: string;
  readonly url: string;
  readonly translations: Record<string, string>;
  readonly feedback: readonly Feedback[];
}

export interface ProjectResponse {
  readonly message: string;
  readonly project: Project;
}

export interface CommentResponse {
  readonly message: string;
  readonly comment: Comment;
}

export interface ResolveResponse {
  readonly message: string;
  readonly feedback: Feedback;
}

export interface FeedbackSummary {
  readonly id: number;
  readonly type: "screenshot" | "video" | "text";
  readonly title: string;
  readonly text: string | null;
  readonly reporter_name: string;
  readonly page: string;
  readonly created_at: string;
  readonly resolved_at: string | null;
  readonly comment_count: number;
  readonly has_attachments: boolean;
}

export interface ListOptions {
  readonly limit?: number;
  readonly offset?: number;
  readonly summary?: boolean;
  readonly actioned?: boolean;
}

export type FeedbackFilter = {
  resolved?: boolean;
  page?: string;
  reporter?: string;
  type?: "screenshot" | "video" | "text";
  created_after?: string;
  created_before?: string;
};

export interface ValidationResult {
  readonly success: boolean;
  readonly errors: readonly string[];
}