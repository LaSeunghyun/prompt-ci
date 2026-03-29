/**
 * Retry utility with exponential backoff for transient provider errors.
 */

import { ProviderError } from '../providers/base.js';

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const MAX_RETRIES = 2;
const BASE_DELAY_MS = 1000;

function isRetryable(err: unknown): boolean {
  if (err instanceof ProviderError && err.statusCode) {
    return RETRYABLE_STATUS_CODES.has(err.statusCode);
  }
  // Network errors (fetch failures) are retryable
  if (err instanceof TypeError && (err.message.includes('fetch') || err.message.includes('network'))) {
    return true;
  }
  return false;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = MAX_RETRIES,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (attempt >= maxRetries || !isRetryable(err)) {
        throw err;
      }

      // Exponential backoff with jitter
      const delay = BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 500;

      // Respect Retry-After header if available
      if (err instanceof ProviderError && err.statusCode === 429) {
        // ProviderError message may contain Retry-After info; use base delay
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
