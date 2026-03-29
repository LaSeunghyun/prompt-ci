import type { Assertion, AssertionResult, ProviderAdapter } from '../types.js';

const PASS_THRESHOLD = 0.7;

const JUDGE_PROMPT = `You are an impartial evaluator. Given a response and evaluation criteria, score the response.

Respond with a JSON object in this exact format (no markdown, no extra text):
{"score": <number between 0 and 1>, "reasoning": "<brief explanation>"}

Criteria:
{{criteria}}

Response to evaluate:
{{response}}`;

/**
 * Evaluate a response using an LLM judge.
 *
 * Sends the response and criteria to the judge model and expects a JSON reply
 * with a score (0-1) and reasoning. A score >= 0.7 is considered passing.
 */
export async function evaluateWithJudge(
  response: string,
  criteria: string,
  adapter: ProviderAdapter,
  model: string,
  assertion: Assertion,
  durationMs: number,
): Promise<AssertionResult> {
  const userMessage = JUDGE_PROMPT
    .replace('{{criteria}}', criteria)
    .replace('{{response}}', response);

  let judgeResponse: string;
  try {
    const result = await adapter.chat({
      model,
      userMessage,
      temperature: 0,
      maxTokens: 256,
    });
    judgeResponse = result.content.trim();
  } catch (err) {
    return {
      assertion,
      passed: false,
      message: `LLM judge call failed: ${(err as Error).message}`,
      score: 0,
      durationMs,
    };
  }

  let parsed: { score: number; reasoning: string };
  try {
    // Strip possible markdown code fences
    const json = judgeResponse.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim();
    parsed = JSON.parse(json) as { score: number; reasoning: string };
  } catch {
    return {
      assertion,
      passed: false,
      message: `LLM judge returned invalid JSON: ${judgeResponse.slice(0, 200)}`,
      score: 0,
      durationMs,
    };
  }

  const score = Math.max(0, Math.min(1, Number(parsed.score) || 0));
  const passed = score >= PASS_THRESHOLD;

  return {
    assertion,
    passed,
    message: passed
      ? `LLM judge passed with score ${score.toFixed(2)}`
      : `LLM judge failed with score ${score.toFixed(2)} (threshold: ${PASS_THRESHOLD})`,
    reasoning: parsed.reasoning,
    score,
    durationMs,
  };
}
