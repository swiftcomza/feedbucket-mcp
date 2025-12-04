/**
 * Purpose: Configuration management with environment variable handling and bundle-time injection
 * Dependencies: None
 * 
 * Example Input:
 * ```
 * process.env.FEEDBUCKET_PROJECT_KEY = "S3q9juJHLaa1f7U3kBAx"
 * ```
 * 
 * Expected Output:
 * ```
 * { projectKey: "S3q9juJHLaa1f7U3kBAx", apiKey: "...", baseUrl: "..." }
 * ```
 */

import type { FeedbucketConfig, ValidationResult } from './types.js';

const DEFAULT_BASE_URL = 'https://dashboard.feedbucket.app/api/v1';

function validateConfig(config: Partial<FeedbucketConfig>): ValidationResult {
  const errors: string[] = [];
  
  if (!config.projectId) {
    errors.push('FEEDBUCKET_PROJECT_ID is required');
  }
  
  if (!config.privateKey) {
    errors.push('FEEDBUCKET_PRIVATE_KEY is required');
  }
  
  if (!config.baseUrl) {
    errors.push('FEEDBUCKET_BASE_URL is required');
  }
  
  return {
    success: errors.length === 0,
    errors
  };
}

export function getConfig(): FeedbucketConfig {
  // Read environment variables at runtime (not bundled at build time)
  const runtimeConfig: Partial<FeedbucketConfig> = {
    projectId: process.env.FEEDBUCKET_PROJECT_ID || '',
    privateKey: process.env.FEEDBUCKET_PRIVATE_KEY || '',
    baseUrl: process.env.FEEDBUCKET_BASE_URL || DEFAULT_BASE_URL,
    ...(process.env.FEEDBUCKET_API_KEY && { apiKey: process.env.FEEDBUCKET_API_KEY })
  };
  
  const validation = validateConfig(runtimeConfig);
  
  if (!validation.success) {
    const errorMessage = `Configuration validation failed:\n${validation.errors.join('\n')}`;
    throw new Error(errorMessage);
  }
  
  return runtimeConfig as FeedbucketConfig;
}

