import { describe, it, expect } from 'vitest';
import { evaluateContains } from '../assertions/contains.js';
import { evaluateRegex } from '../assertions/regex.js';
import type { Assertion } from '../types.js';

// Minimal assertion fixture
function makeAssertion(overrides: Partial<Assertion> = {}): Assertion {
  return { type: 'contains', value: 'test', ...overrides };
}

// -----------------------------------------------------------------------
// contains / not-contains
// -----------------------------------------------------------------------

describe('evaluateContains', () => {
  it('returns passed=true when the response contains the needle', () => {
    const result = evaluateContains(
      'Hello World',
      'World',
      false,
      makeAssertion(),
      10,
    );
    expect(result.passed).toBe(true);
  });

  it('returns passed=false when the response does not contain the needle', () => {
    const result = evaluateContains(
      'Hello World',
      'missing',
      false,
      makeAssertion(),
      10,
    );
    expect(result.passed).toBe(false);
  });

  it('performs case-insensitive match when value starts with ~', () => {
    const result = evaluateContains(
      'Hello World',
      '~WORLD',
      false,
      makeAssertion(),
      10,
    );
    expect(result.passed).toBe(true);
  });

  it('strips the ~ prefix before comparing', () => {
    const result = evaluateContains(
      'Hello World',
      '~hello',
      false,
      makeAssertion(),
      10,
    );
    expect(result.passed).toBe(true);
  });

  it('negate=true passes when needle is NOT found', () => {
    const result = evaluateContains(
      'Hello World',
      'missing',
      true,
      makeAssertion({ type: 'not-contains' }),
      10,
    );
    expect(result.passed).toBe(true);
  });

  it('negate=true fails when needle IS found', () => {
    const result = evaluateContains(
      'Hello World',
      'World',
      true,
      makeAssertion({ type: 'not-contains' }),
      10,
    );
    expect(result.passed).toBe(false);
  });

  it('score is 1 when assertion passes', () => {
    const result = evaluateContains('abc', 'a', false, makeAssertion(), 5);
    expect(result.score).toBe(1);
  });

  it('score is 0 when assertion fails', () => {
    const result = evaluateContains('abc', 'z', false, makeAssertion(), 5);
    expect(result.score).toBe(0);
  });

  it('returns the provided durationMs on the result', () => {
    const result = evaluateContains('abc', 'a', false, makeAssertion(), 42);
    expect(result.durationMs).toBe(42);
  });
});

// -----------------------------------------------------------------------
// regex / not-regex
// -----------------------------------------------------------------------

describe('evaluateRegex', () => {
  it('passes when pattern matches the response', () => {
    const result = evaluateRegex(
      'The price is $10',
      '\\$\\d+',
      false,
      makeAssertion({ type: 'regex' }),
      10,
    );
    expect(result.passed).toBe(true);
  });

  it('fails when pattern does not match', () => {
    const result = evaluateRegex(
      'Hello',
      '\\d+',
      false,
      makeAssertion({ type: 'regex' }),
      10,
    );
    expect(result.passed).toBe(false);
  });

  it('negate=true passes when pattern does NOT match', () => {
    const result = evaluateRegex(
      'Hello',
      '\\d+',
      true,
      makeAssertion({ type: 'not-regex' }),
      10,
    );
    expect(result.passed).toBe(true);
  });

  it('negate=true fails when pattern DOES match', () => {
    const result = evaluateRegex(
      'abc123',
      '\\d+',
      true,
      makeAssertion({ type: 'not-regex' }),
      10,
    );
    expect(result.passed).toBe(false);
  });

  it('returns passed=false and score=0 for an invalid regex pattern', () => {
    const result = evaluateRegex(
      'anything',
      '[invalid',
      false,
      makeAssertion({ type: 'regex' }),
      10,
    );
    expect(result.passed).toBe(false);
    expect(result.score).toBe(0);
  });

  it('includes "Invalid regex" in the message for a bad pattern', () => {
    const result = evaluateRegex(
      'anything',
      '[invalid',
      false,
      makeAssertion({ type: 'regex' }),
      10,
    );
    expect(result.message).toMatch(/Invalid regex/i);
  });

  it('rejects the ReDoS pattern (a+)+b and returns passed=false', () => {
    const result = evaluateRegex(
      'aaaa',
      '(a+)+b',
      false,
      makeAssertion({ type: 'regex' }),
      10,
    );
    expect(result.passed).toBe(false);
    expect(result.score).toBe(0);
  });

  it('mentions "ReDoS" in the rejection message', () => {
    const result = evaluateRegex(
      'aaaa',
      '(a+)+b',
      false,
      makeAssertion({ type: 'regex' }),
      10,
    );
    expect(result.message).toMatch(/ReDoS/i);
  });

  it('truncates input longer than 100K characters before matching', () => {
    // Build a string of 200K 'a's then append 'TARGET' at position 150K
    // Because input is truncated to 100K, 'TARGET' at 150K will not be found
    const longInput = 'a'.repeat(100_001) + 'TARGET';
    const result = evaluateRegex(
      longInput,
      'TARGET',
      false,
      makeAssertion({ type: 'regex' }),
      10,
    );
    expect(result.passed).toBe(false);
  });

  it('score is 1 on a passing regex match', () => {
    const result = evaluateRegex(
      'hello',
      'hel+o',
      false,
      makeAssertion({ type: 'regex' }),
      10,
    );
    expect(result.score).toBe(1);
  });
});
