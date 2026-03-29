import type { Assertion, AssertionResult } from '../types.js';

const DEFAULT_THRESHOLD = 0.6;

/**
 * Compute Jaccard similarity between two strings using word-level overlap.
 *
 * Jaccard = |intersection| / |union|
 */
function jaccardSimilarity(a: string, b: string): number {
  const tokenize = (s: string) =>
    new Set(s.toLowerCase().split(/\W+/).filter(Boolean));

  const setA = tokenize(a);
  const setB = tokenize(b);

  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersectionSize = 0;
  for (const word of setA) {
    if (setB.has(word)) intersectionSize++;
  }

  const unionSize = setA.size + setB.size - intersectionSize;
  return intersectionSize / unionSize;
}

/**
 * Evaluate a similarity assertion using Jaccard word-overlap.
 *
 * @param threshold - Minimum similarity score to pass (default 0.6).
 */
export function evaluateSimilarity(
  response: string,
  reference: string,
  assertion: Assertion,
  durationMs: number,
  threshold: number = DEFAULT_THRESHOLD,
): AssertionResult {
  const score = jaccardSimilarity(response, reference);
  const passed = score >= threshold;

  const message = passed
    ? `Similarity score ${score.toFixed(3)} meets threshold ${threshold}`
    : `Similarity score ${score.toFixed(3)} is below threshold ${threshold}`;

  return {
    assertion,
    passed,
    message,
    score,
    durationMs,
  };
}
