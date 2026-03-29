import type { Assertion, AssertionResult, TokenUsage } from '../types.js';

/**
 * Evaluate a max-tokens assertion.
 */
export function evaluateTokenLimit(
  usage: TokenUsage,
  maxTokens: number,
  assertion: Assertion,
  durationMs: number,
): AssertionResult {
  const { totalTokens } = usage;
  const passed = totalTokens <= maxTokens;

  const message = passed
    ? `Token usage ${totalTokens} is within limit of ${maxTokens}`
    : `Token usage ${totalTokens} exceeds limit of ${maxTokens}`;

  return {
    assertion,
    passed,
    message,
    score: passed ? 1 : Math.max(0, 1 - (totalTokens - maxTokens) / maxTokens),
    durationMs,
  };
}
