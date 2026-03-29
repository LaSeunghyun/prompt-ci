import type { Assertion, AssertionResult } from '../types.js';

/**
 * Evaluate a max-latency assertion.
 *
 * @param latencyMs - Actual latency in milliseconds.
 * @param maxLatencyMs - Maximum allowed latency in milliseconds.
 */
export function evaluateLatency(
  latencyMs: number,
  maxLatencyMs: number,
  assertion: Assertion,
  durationMs: number,
): AssertionResult {
  const passed = latencyMs <= maxLatencyMs;

  const message = passed
    ? `Latency ${latencyMs}ms is within limit of ${maxLatencyMs}ms`
    : `Latency ${latencyMs}ms exceeds limit of ${maxLatencyMs}ms`;

  return {
    assertion,
    passed,
    message,
    score: passed ? 1 : Math.max(0, 1 - (latencyMs - maxLatencyMs) / maxLatencyMs),
    durationMs,
  };
}
