/**
 * Purpose: Feedbucket API client with data filtering and summarization for AI consumption
 * Dependencies: Node.js fetch API
 * 
 * Example Input:
 * ```
 * { projectKey: "S3q9juJHLaa1f7U3kBAx", summary: true, limit: 10 }
 * ```
 * 
 * Expected Output:
 * ```
 * { feedback: [{ id: 326247, title: "Bug report", summary: "..." }] }
 * ```
 */

import type { 
  FeedbucketConfig, 
  ProjectResponse, 
  CommentResponse, 
  ResolveResponse,
  FeedbackSummary,
  ListOptions,
  FeedbackFilter,
  Feedback
} from './types.js';

export class FeedbucketApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly response?: string
  ) {
    super(message);
    this.name = 'FeedbucketApiError';
  }
}

export class FeedbucketApi {
  constructor(private readonly config: FeedbucketConfig) {}
  
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`;
    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      ...options.headers
    };
    
    try {
      const response = await fetch(url, {
        ...options,
        headers
      });
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error(`API Error Details: Status ${response.status}, Response: ${errorText}`);
        throw new FeedbucketApiError(
          `API request failed: ${response.status} ${response.statusText}. Response: ${errorText}`,
          response.status,
          errorText
        );
      }
      
      const data = await response.json() as T;
      return data;
    } catch (error) {
      if (error instanceof FeedbucketApiError) {
        throw error;
      }
      throw new FeedbucketApiError(
        `Network request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        0
      );
    }
  }
  
  private summarizeFeedback(feedback: readonly Feedback[]): readonly FeedbackSummary[] {
    return feedback.map(item => ({
      id: item.id,
      type: item.type,
      title: item.title,
      text: item.text ? (item.text.length > 200 ? `${item.text.slice(0, 200)}...` : item.text) : null,
      reporter_name: item.reporter.name,
      page: item.session_data.page,
      created_at: item.created_at,
      resolved_at: item.resolved_at,
      comment_count: item.comments.length,
      has_attachments: item.attachments.length > 0
    }));
  }
  
  private filterFeedback(
    feedback: readonly Feedback[], 
    filter: FeedbackFilter
  ): readonly Feedback[] {
    return feedback.filter(item => {
      if (filter.resolved !== undefined) {
        const isResolved = item.resolved_at !== null;
        if (filter.resolved !== isResolved) return false;
      }
      
      if (filter.page && !item.session_data.page.includes(filter.page)) {
        return false;
      }
      
      if (filter.reporter && !item.reporter.name.toLowerCase().includes(filter.reporter.toLowerCase())) {
        return false;
      }
      
      if (filter.type && item.type !== filter.type) {
        return false;
      }
      
      if (filter.created_after && item.created_at < filter.created_after) {
        return false;
      }
      
      if (filter.created_before && item.created_at > filter.created_before) {
        return false;
      }
      
      return true;
    });
  }
  
  async getProjectFeedback(
    options: ListOptions & { filter?: FeedbackFilter } = {}
  ): Promise<{ 
    readonly project: ProjectResponse['project']; 
    readonly feedback: readonly FeedbackSummary[] | readonly Feedback[];
    readonly total_count: number;
    readonly data_optimization: {
      readonly original_count: number;
      readonly filtered_count: number;
      readonly returned_count: number;
      readonly truncated_session_data: boolean;
      readonly summarized: boolean;
    };
  }> {
    let endpoint = `/projects/${this.config.projectId}`;
    if (this.config.apiKey) {
      endpoint += `?feedbucketKey=${this.config.apiKey}`;
    }
    const response = await this.makeRequest<ProjectResponse>(endpoint);
    
    const originalCount = response.project.feedback.length;
    
    let filteredFeedback = response.project.feedback;
    
    if (options.filter) {
      filteredFeedback = this.filterFeedback(response.project.feedback, options.filter);
    }
    
    const filteredCount = filteredFeedback.length;
    
    if (options.offset || options.limit) {
      const start = options.offset || 0;
      const end = options.limit ? start + options.limit : undefined;
      filteredFeedback = filteredFeedback.slice(start, end);
    }
    
    const returnedCount = filteredFeedback.length;
    
    const processedFeedback = options.summary !== false 
      ? this.summarizeFeedback(filteredFeedback)
      : this.optimizeFeedbackForAI(filteredFeedback);
    
    return {
      project: response.project,
      feedback: processedFeedback,
      total_count: filteredCount,
      data_optimization: {
        original_count: originalCount,
        filtered_count: filteredCount,
        returned_count: returnedCount,
        truncated_session_data: true,
        summarized: options.summary !== false
      }
    };
  }
  
  private optimizeFeedbackForAI(feedback: readonly Feedback[]): readonly Feedback[] {
    return feedback.map(item => ({
      ...item,
      session_data: {
        page: item.session_data.page,
        device: item.session_data.device,
        system: item.session_data.system,
        browser: item.session_data.browser,
        selector: {
          path: item.session_data.selector.path,
          pathWithClass: item.session_data.selector.pathWithClass,
          offset: item.session_data.selector.offset,
          scrollableSelector: item.session_data.selector.scrollableSelector
        },
        userAgent: item.session_data.userAgent,
        screenWidth: item.session_data.screenWidth,
        screenHeight: item.session_data.screenHeight,
        viewportWidth: item.session_data.viewportWidth,
        viewportHeight: item.session_data.viewportHeight,
        widgetVersion: item.session_data.widgetVersion,
        devDataOverview: item.session_data.devDataOverview,
        devicePixelRatio: item.session_data.devicePixelRatio
      }
    }));
  }
  
  async getFeedbackById(feedbackId: number): Promise<Feedback> {
    const allFeedback = await this.getProjectFeedback({ summary: false });
    const feedback = (allFeedback.feedback as readonly Feedback[])
      .find(item => item.id === feedbackId);
    
    if (!feedback) {
      throw new FeedbucketApiError(`Feedback with ID ${feedbackId} not found`, 404);
    }
    
    return feedback;
  }
  
  async addComment(
    feedbackId: number, 
    body: string, 
    reporterName?: string,
    reporterEmail?: string,
    resolve: boolean = false
  ): Promise<CommentResponse> {
    const endpoint = `/feedback/${feedbackId}/comments?key=${this.config.privateKey}`;
    const payload = {
      body,
      resolve,
      reporter: {
        name: reporterName || 'Claude AI Assistant',
        email: reporterEmail || 'claude@anthropic.com'
      },
      mentions: null,
      attachments: null
    };
    
    return this.makeRequest<CommentResponse>(endpoint, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }
  
  async resolveFeedback(feedbackId: number): Promise<ResolveResponse> {
    const endpoint = `/feedback/${feedbackId}/resolve?key=${this.config.privateKey}`;
    
    return this.makeRequest<ResolveResponse>(endpoint, {
      method: 'PUT',
      body: JSON.stringify({})
    });
  }
  
  async getStatus(): Promise<{ status: string; timestamp: string }> {
    try {
      let endpoint = `/projects/${this.config.projectId}`;
      if (this.config.apiKey) {
        endpoint += `?feedbucketKey=${this.config.apiKey}`;
      }
      await this.makeRequest(endpoint);
      return {
        status: 'connected',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: error instanceof FeedbucketApiError ? `error: ${error.message}` : 'error: unknown',
        timestamp: new Date().toISOString()
      };
    }
  }
}


