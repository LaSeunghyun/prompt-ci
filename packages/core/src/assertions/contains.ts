import type { Assertion, AssertionResult } from '../types.js';

/**
 * Evaluate a contains or not-contains assertion.
 *
 * If value starts with `~`, the check is case-insensitive (the `~` prefix is
 * stripped before comparison).
 */
export function evaluateContains(
  response: string,
  value: string,
  negate: boolean,
  assertion: Assertion,
  durationMs: number,
): AssertionResult {
  let caseInsensitive = false;
  let needle = value;

  if (needle.startsWith('~')) {
    caseInsensitive = true;
    needle = needle.slice(1);
  }

  const haystack = caseInsensitive ? response.toLowerCase() : response;
  const normalizedNeedle = caseInsensitive ? needle.toLowerCase() : needle;

  const found = haystack.includes(normalizedNeedle);
  const passed = negate ? !found : found;

  const direction = negate ? 'not contain' : 'contain';
  const message = passed
    ? `Response does ${negate ? 'not ' : ''}contain "${needle}"`
    : `Expected response to ${direction} "${needle}"`;

  return {
    assertion,
    passed,
    message,
    score: passed ? 1 : 0,
    durationMs,
  };
}
