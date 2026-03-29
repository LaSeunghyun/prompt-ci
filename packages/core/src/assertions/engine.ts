import type { Assertion, AssertionResult, PromptResponse, ProviderAdapter } from '../types.js';
import { evaluateContains } from './contains.js';
import { evaluateRegex } from './regex.js';
import { evaluateJsonSchema, evaluateIsJson } from './json-schema.js';
import { evaluateTokenLimit } from './token-limit.js';
import { evaluateCostLimit } from './cost-limit.js';
import { evaluateLatency } from './latency.js';
import { evaluateWithJudge } from './llm-judge.js';
import { evaluateSimilarity } from './similarity.js';

/**
 * Dispatch an assertion to the correct handler and return the result.
 */
export async function evaluateAssertion(
  assertion: Assertion,
  response: PromptResponse,
  judgeAdapter?: ProviderAdapter,
  judgeModel?: string,
): Promise<AssertionResult> {
  const start = Date.now();

  const result = await _dispatch(assertion, response, judgeAdapter, judgeModel, start);
  return result;
}

async function _dispatch(
  assertion: Assertion,
  response: PromptResponse,
  judgeAdapter: ProviderAdapter | undefined,
  judgeModel: string | undefined,
  start: number,
): Promise<AssertionResult> {
  const elapsed = () => Date.now() - start;

  switch (assertion.type) {
    case 'contains':
      return evaluateContains(
        response.content,
        String(assertion.value ?? ''),
        false,
        assertion,
        elapsed(),
      );

    case 'not-contains':
      return evaluateContains(
        response.content,
        String(assertion.value ?? ''),
        true,
        assertion,
        elapsed(),
      );

    case 'regex':
      return evaluateRegex(
        response.content,
        String(assertion.value ?? ''),
        false,
        assertion,
        elapsed(),
      );

    case 'not-regex':
      return evaluateRegex(
        response.content,
        String(assertion.value ?? ''),
        true,
        assertion,
        elapsed(),
      );

    case 'json-schema':
      return evaluateJsonSchema(
        response.content,
        assertion.value as object,
        assertion,
        elapsed(),
      );

    case 'is-json':
      return evaluateIsJson(response.content, assertion, elapsed());

    case 'max-tokens':
      return evaluateTokenLimit(
        response.usage,
        Number(assertion.value ?? 0),
        assertion,
        elapsed(),
      );

    case 'cost-limit':
      return evaluateCostLimit(
        response.cost,
        Number(assertion.value ?? 0),
        assertion,
        elapsed(),
      );

    case 'max-latency':
      return evaluateLatency(
        response.latencyMs,
        Number(assertion.value ?? 0),
        assertion,
        elapsed(),
      );

    case 'llm-judge': {
      if (!judgeAdapter || !judgeModel) {
        return {
          assertion,
          passed: false,
          message: 'llm-judge assertion requires a judge provider and model to be configured',
          score: 0,
          durationMs: elapsed(),
        };
      }
      const criteria = assertion.criteria ?? String(assertion.value ?? '');
      return evaluateWithJudge(
        response.content,
        criteria,
        judgeAdapter,
        judgeModel,
        assertion,
        elapsed(),
      );
    }

    case 'similarity':
      return evaluateSimilarity(
        response.content,
        assertion.reference ?? String(assertion.value ?? ''),
        assertion,
        elapsed(),
        typeof assertion.value === 'number' ? assertion.value : undefined,
      );

    case 'custom-fn':
      return {
        assertion,
        passed: false,
        message: 'custom-fn assertions must be evaluated by the caller',
        score: 0,
        durationMs: elapsed(),
      };

    default: {
      const exhaustive: never = assertion.type;
      return {
        assertion,
        passed: false,
        message: `Unknown assertion type: ${exhaustive as string}`,
        score: 0,
        durationMs: elapsed(),
      };
    }
  }
}
