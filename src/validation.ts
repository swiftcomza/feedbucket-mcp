/**
 * Purpose: Runtime validation functions for API responses and user inputs
 * Dependencies: None
 * 
 * Example Input:
 * ```
 * { id: "invalid", type: "unknown", data: null }
 * ```
 * 
 * Expected Output:
 * ```
 * { success: false, errors: ["id must be number", "type must be valid"] }
 * ```
 */

import type { 
  ValidationResult
} from './types.js';

export function validateNumber(value: unknown, fieldName: string): ValidationResult {
  const errors: string[] = [];
  
  if (typeof value !== 'number' || isNaN(value)) {
    errors.push(`${fieldName} must be a valid number`);
  }
  
  return {
    success: errors.length === 0,
    errors
  };
}

export function validateString(value: unknown, fieldName: string, required = true): ValidationResult {
  const errors: string[] = [];
  
  if (required && (!value || typeof value !== 'string' || value.trim() === '')) {
    errors.push(`${fieldName} is required and must be a non-empty string`);
  } else if (value !== null && value !== undefined && typeof value !== 'string') {
    errors.push(`${fieldName} must be a string`);
  }
  
  return {
    success: errors.length === 0,
    errors
  };
}

export function validateBoolean(value: unknown, fieldName: string): ValidationResult {
  const errors: string[] = [];
  
  if (value !== undefined && typeof value !== 'boolean') {
    errors.push(`${fieldName} must be a boolean`);
  }
  
  return {
    success: errors.length === 0,
    errors
  };
}

export function validateReporter(data: unknown): ValidationResult {
  const errors: string[] = [];
  
  if (!data || typeof data !== 'object') {
    return { success: false, errors: ['Reporter data must be an object'] };
  }
  
  const reporter = data as Record<string, unknown>;
  
  const idValidation = validateNumber(reporter.id, 'reporter.id');
  const nameValidation = validateString(reporter.name, 'reporter.name');
  const emailValidation = validateString(reporter.email, 'reporter.email');
  const notificationsValidation = validateBoolean(reporter.notifications, 'reporter.notifications');
  
  errors.push(...idValidation.errors);
  errors.push(...nameValidation.errors);
  errors.push(...emailValidation.errors);
  errors.push(...notificationsValidation.errors);
  
  return {
    success: errors.length === 0,
    errors
  };
}

export function validateSessionData(data: unknown): ValidationResult {
  const errors: string[] = [];
  
  if (!data || typeof data !== 'object') {
    return { success: false, errors: ['Session data must be an object'] };
  }
  
  const session = data as Record<string, unknown>;
  
  const pageValidation = validateString(session.page, 'session_data.page');
  const deviceValidation = validateString(session.device, 'session_data.device');
  const systemValidation = validateString(session.system, 'session_data.system');
  const browserValidation = validateString(session.browser, 'session_data.browser');
  
  errors.push(...pageValidation.errors);
  errors.push(...deviceValidation.errors);
  errors.push(...systemValidation.errors);
  errors.push(...browserValidation.errors);
  
  if (session.selector && typeof session.selector === 'object') {
    const selector = session.selector as Record<string, unknown>;
    const pathValidation = validateString(selector.path, 'session_data.selector.path');
    errors.push(...pathValidation.errors);
  }
  
  return {
    success: errors.length === 0,
    errors
  };
}

export function validateComment(data: unknown): ValidationResult {
  const errors: string[] = [];
  
  if (!data || typeof data !== 'object') {
    return { success: false, errors: ['Comment data must be an object'] };
  }
  
  const comment = data as Record<string, unknown>;
  
  const idValidation = validateNumber(comment.id, 'comment.id');
  const bodyValidation = validateString(comment.body, 'comment.body');
  const nameValidation = validateString(comment.name, 'comment.name');
  const createdAtValidation = validateString(comment.created_at, 'comment.created_at');
  
  errors.push(...idValidation.errors);
  errors.push(...bodyValidation.errors);
  errors.push(...nameValidation.errors);
  errors.push(...createdAtValidation.errors);
  
  if (!Array.isArray(comment.attachments)) {
    errors.push('comment.attachments must be an array');
  }
  
  return {
    success: errors.length === 0,
    errors
  };
}

export function validateFeedback(data: unknown): ValidationResult {
  const errors: string[] = [];
  
  if (!data || typeof data !== 'object') {
    return { success: false, errors: ['Feedback data must be an object'] };
  }
  
  const feedback = data as Record<string, unknown>;
  
  const idValidation = validateNumber(feedback.id, 'feedback.id');
  const titleValidation = validateString(feedback.title, 'feedback.title');
  const createdAtValidation = validateString(feedback.created_at, 'feedback.created_at');
  
  errors.push(...idValidation.errors);
  errors.push(...titleValidation.errors);
  errors.push(...createdAtValidation.errors);
  
  if (feedback.type && !['screenshot', 'video', 'text'].includes(feedback.type as string)) {
    errors.push('feedback.type must be "screenshot", "video", or "text"');
  }
  
  if (feedback.reporter) {
    const reporterValidation = validateReporter(feedback.reporter);
    errors.push(...reporterValidation.errors);
  }
  
  if (feedback.session_data) {
    const sessionValidation = validateSessionData(feedback.session_data);
    errors.push(...sessionValidation.errors);
  }
  
  if (feedback.comments && Array.isArray(feedback.comments)) {
    feedback.comments.forEach((comment, index) => {
      const commentValidation = validateComment(comment);
      errors.push(...commentValidation.errors.map(err => `comments[${index}].${err}`));
    });
  }
  
  return {
    success: errors.length === 0,
    errors
  };
}

export function validateListOptions(data: unknown): ValidationResult {
  const errors: string[] = [];
  
  if (data && typeof data === 'object') {
    const options = data as Record<string, unknown>;
    
    if (options.limit !== undefined) {
      const limitValidation = validateNumber(options.limit, 'limit');
      errors.push(...limitValidation.errors);
      
      if (typeof options.limit === 'number' && (options.limit < 1 || options.limit > 100)) {
        errors.push('limit must be between 1 and 100');
      }
    }
    
    if (options.offset !== undefined) {
      const offsetValidation = validateNumber(options.offset, 'offset');
      errors.push(...offsetValidation.errors);
      
      if (typeof options.offset === 'number' && options.offset < 0) {
        errors.push('offset must be non-negative');
      }
    }
    
    if (options.summary !== undefined) {
      const summaryValidation = validateBoolean(options.summary, 'summary');
      errors.push(...summaryValidation.errors);
    }
    
    if (options.actioned !== undefined) {
      const actionedValidation = validateBoolean(options.actioned, 'actioned');
      errors.push(...actionedValidation.errors);
    }
  }
  
  return {
    success: errors.length === 0,
    errors
  };
}

export function validateFeedbackFilter(data: unknown): ValidationResult {
  const errors: string[] = [];
  
  if (data && typeof data === 'object') {
    const filter = data as Record<string, unknown>;
    
    if (filter.resolved !== undefined) {
      const resolvedValidation = validateBoolean(filter.resolved, 'filter.resolved');
      errors.push(...resolvedValidation.errors);
    }
    
    if (filter.page !== undefined) {
      const pageValidation = validateString(filter.page, 'filter.page', false);
      errors.push(...pageValidation.errors);
    }
    
    if (filter.reporter !== undefined) {
      const reporterValidation = validateString(filter.reporter, 'filter.reporter', false);
      errors.push(...reporterValidation.errors);
    }
    
    if (filter.type !== undefined && !['screenshot', 'video', 'text'].includes(filter.type as string)) {
      errors.push('filter.type must be "screenshot", "video", or "text"');
    }
    
    if (filter.created_after !== undefined) {
      const createdAfterValidation = validateString(filter.created_after, 'filter.created_after', false);
      errors.push(...createdAfterValidation.errors);
    }
    
    if (filter.created_before !== undefined) {
      const createdBeforeValidation = validateString(filter.created_before, 'filter.created_before', false);
      errors.push(...createdBeforeValidation.errors);
    }
  }
  
  return {
    success: errors.length === 0,
    errors
  };
}

