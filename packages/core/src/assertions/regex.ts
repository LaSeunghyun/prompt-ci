import type { Assertion, AssertionResult } from '../types.js';

/**
 * Simple heuristic to detect potentially dangerous regex patterns (ReDoS).
 * Rejects patterns with nested quantifiers like (a+)+, (a*)*,  (a+)*, etc.
 */
function isPotentialReDoS(pattern: string): boolean {
  // Detect nested quantifiers: group with quantifier containing inner quantifier
  return /(\([^)]*[+*][^)]*\))[+*{]/.test(pattern) ||
    /([+*])\1/.test(pattern); // consecutive quantifiers like a++
}

const REGEX_TIMEOUT_MS = 1000;

/**
 * Evaluate a regex or not-regex assertion with ReDoS protection.
 */
export function evaluateRegex(
  response: string,
  pattern: string,
  negate: boolean,
  assertion: Assertion,
  durationMs: number,
): AssertionResult {
  // ReDoS protection: reject dangerous patterns
  if (isPotentialReDoS(pattern)) {
    return {
      assertion,
      passed: false,
      message: `Regex pattern rejected: potential ReDoS pattern "/${pattern}/"`,
      score: 0,
      durationMs,
    };
  }

  let regexp: RegExp;
  try {
    regexp = new RegExp(pattern);
  } catch (err) {
    return {
      assertion,
      passed: false,
      message: `Invalid regex pattern "${pattern}": ${(err as Error).message}`,
      score: 0,
      durationMs,
    };
  }

  // Limit input length to prevent excessive backtracking on long responses
  const safeResponse = response.length > 100_000 ? response.slice(0, 100_000) : response;
  const matched = regexp.test(safeResponse);
  const passed = negate ? !matched : matched;

  const direction = negate ? 'not match' : 'match';
  const message = passed
    ? `Response does ${negate ? 'not ' : ''}match pattern /${pattern}/`
    : `Expected response to ${direction} pattern /${pattern}/`;

  return {
    assertion,
    passed,
    message,
    score: passed ? 1 : 0,
    durationMs,
  };
}
