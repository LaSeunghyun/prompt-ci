import Ajv from 'ajv';
import type { Assertion, AssertionResult } from '../types.js';

const ajv = new Ajv({ allErrors: true });

/**
 * Evaluate a json-schema assertion.
 *
 * First checks that the response is valid JSON, then validates the parsed
 * value against the provided JSON Schema.
 */
export function evaluateJsonSchema(
  response: string,
  schema: object,
  assertion: Assertion,
  durationMs: number,
): AssertionResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(response);
  } catch {
    return {
      assertion,
      passed: false,
      message: 'Response is not valid JSON',
      score: 0,
      durationMs,
    };
  }

  const validate = ajv.compile(schema);
  const valid = validate(parsed);

  if (valid) {
    return {
      assertion,
      passed: true,
      message: 'Response matches the JSON schema',
      score: 1,
      durationMs,
    };
  }

  const errors = ajv.errorsText(validate.errors);
  return {
    assertion,
    passed: false,
    message: `Response does not match JSON schema: ${errors}`,
    score: 0,
    durationMs,
  };
}

/**
 * Evaluate an is-json assertion (no schema, just valid JSON check).
 */
export function evaluateIsJson(
  response: string,
  assertion: Assertion,
  durationMs: number,
): AssertionResult {
  try {
    JSON.parse(response);
    return {
      assertion,
      passed: true,
      message: 'Response is valid JSON',
      score: 1,
      durationMs,
    };
  } catch {
    return {
      assertion,
      passed: false,
      message: 'Response is not valid JSON',
      score: 0,
      durationMs,
    };
  }
}
