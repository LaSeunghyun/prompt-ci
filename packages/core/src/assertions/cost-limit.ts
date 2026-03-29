import type { Assertion, AssertionResult } from '../types.js';

/**
 * Evaluate a cost-limit assertion.
 *
 * @param cost - Actual cost in USD.
 * @param maxCost - Maximum allowed cost in USD.
 */
export function evaluateCostLimit(
  cost: number,
  maxCost: number,
  assertion: Assertion,
  durationMs: number,
): AssertionResult {
  const passed = cost <= maxCost;

  const fmt = (n: number) => `$${n.toFixed(6)}`;
  const message = passed
    ? `Cost ${fmt(cost)} is within limit of ${fmt(maxCost)}`
    : `Cost ${fmt(cost)} exceeds limit of ${fmt(maxCost)}`;

  return {
    assertion,
    passed,
    message,
    score: passed ? 1 : Math.max(0, 1 - (cost - maxCost) / maxCost),
    durationMs,
  };
}
