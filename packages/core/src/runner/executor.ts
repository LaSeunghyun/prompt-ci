import { nanoid } from 'nanoid';
import pLimit from 'p-limit';
import type {
  PromptFile,
  TestCase,
  TestResult,
  EvalRun,
  PromptCIConfig,
  ProviderAdapter,
  PromptResponse,
  AssertionResult,
} from '../types.js';
import { resolveVariables } from '../parser/variables.js';
import { interpolate } from '../parser/interpolator.js';
import { evaluateAssertion } from '../assertions/engine.js';
import { RunContext } from './context.js';
import { createDefaultRegistry } from '../providers/registry.js';
import { withRetry } from './retry.js';

export interface RunOptions {
  concurrency?: number;
  timeoutMs?: number;
  dryRun?: boolean;
  /** Regex string to filter test names — only matching tests are run. */
  filter?: string;
  /** Optional callback invoked after each test completes (for progress). */
  onTestComplete?: (result: TestResult, index: number, total: number) => void;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function runEval(
  promptFiles: PromptFile[],
  config: PromptCIConfig,
  options: RunOptions = {},
): Promise<EvalRun> {
  const concurrency = options.concurrency ?? config.concurrency ?? 5;
  const timeoutMs = options.timeoutMs ?? config.timeoutMs ?? 30_000;
  const filterRe = options.filter ? new RegExp(options.filter) : undefined;

  const MAX_CONCURRENCY = 50;
  const safeConcurrency = Math.min(Math.max(1, concurrency), MAX_CONCURRENCY);

  // Build provider registry from config
  const registry = createDefaultRegistry(config);
  const providers = new Map<string, ProviderAdapter>();
  // Transfer registry entries into the map for RunContext
  for (const name of ['openai', 'anthropic', 'ollama'] as const) {
    const adapter = registry.get(name);
    if (adapter) providers.set(name, adapter);
  }
  const ctx = new RunContext(config, providers);

  const startedAt = new Date().toISOString();
  const limit = pLimit(safeConcurrency);

  // Collect all (promptFile, testCase) pairs
  const tasks: Array<{ promptFile: PromptFile; testCase: TestCase }> = [];
  for (const promptFile of promptFiles) {
    for (const testCase of promptFile.tests ?? []) {
      if (filterRe && !filterRe.test(testCase.name)) continue;
      tasks.push({ promptFile, testCase });
    }
  }

  let completedCount = 0;
  const totalCount = tasks.length;
  const results: TestResult[] = await Promise.all(
    tasks.map(({ promptFile, testCase }) =>
      limit(async () => {
        const result = await runSingleTest(promptFile, testCase, ctx, {
          timeoutMs: testCase.timeoutMs ?? timeoutMs,
          dryRun: options.dryRun ?? false,
        });
        completedCount++;
        options.onTestComplete?.(result, completedCount, totalCount);
        return result;
      }),
    ),
  );

  const finishedAt = new Date().toISOString();
  const summary = buildSummary(results, ctx);

  return {
    id: nanoid(),
    startedAt,
    finishedAt,
    results,
    summary,
  };
}

// ---------------------------------------------------------------------------
// Single test execution
// ---------------------------------------------------------------------------

async function runSingleTest(
  promptFile: PromptFile,
  testCase: TestCase,
  ctx: RunContext,
  opts: { timeoutMs: number; dryRun: boolean },
): Promise<TestResult> {
  const testStart = Date.now();

  // 1. Resolve variables
  const vars = resolveVariables(promptFile, testCase);

  // 2. Interpolate template
  const userMessage = interpolate(promptFile.template, vars);

  // 3. Determine model and provider
  const model = testCase.model ?? promptFile.model ?? ctx.config.defaultModel ?? 'gpt-4o-mini';
  const providerName = promptFile.provider ?? ctx.config.defaultProvider ?? 'openai';
  const adapter = ctx.getProvider(providerName) ?? ctx.getDefaultProvider();

  // 4. dryRun — estimate cost without calling provider
  if (opts.dryRun) {
    const dummyResponse: PromptResponse = {
      content: '[dry-run: no response]',
      model,
      provider: providerName,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      cost: 0,
      latencyMs: 0,
      finishReason: 'dry-run',
    };
    const assertionResults = buildSkippedAssertions(testCase, dummyResponse);
    return buildTestResult(promptFile.name, testCase, dummyResponse, assertionResults, testStart);
  }

  // 5. Ensure we have a provider adapter
  if (!adapter) {
    throw new Error(
      `Provider "${providerName}" is not configured. ` +
      `Add it to promptci.config.yaml providers section or set the appropriate API key env var.`,
    );
  }

  // 6. Call provider with timeout
  let response: PromptResponse;
  try {
    response = await withTimeout(
      withRetry(() => callProvider(adapter, promptFile, testCase, model, userMessage)),
      opts.timeoutMs,
    );
  } catch (err) {
    const errorResponse: PromptResponse = {
      content: '',
      model,
      provider: providerName,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      cost: 0,
      latencyMs: Date.now() - testStart,
      finishReason: 'error',
    };
    const failedAssertions = buildErrorAssertions(
      testCase,
      errorResponse,
      (err as Error).message,
    );
    return buildTestResult(promptFile.name, testCase, errorResponse, failedAssertions, testStart);
  }

  // 6. Resolve judge adapter/model for llm-judge assertions
  const judgeConfig = promptFile.tests
    ? testCase.assertions.find((a) => a.type === 'llm-judge')?.judge ?? ctx.config.judge
    : ctx.config.judge;
  const judgeProviderName = judgeConfig?.provider ?? ctx.config.defaultProvider ?? 'openai';
  const judgeModel = judgeConfig?.model ?? ctx.config.defaultModel ?? model;
  const judgeAdapter = ctx.getProvider(judgeProviderName) ?? adapter;

  // 7. Run all assertions
  const assertionResults: AssertionResult[] = await Promise.all(
    testCase.assertions.map((assertion) =>
      evaluateAssertion(assertion, response, judgeAdapter, judgeModel),
    ),
  );

  return buildTestResult(promptFile.name, testCase, response, assertionResults, testStart);
}

// ---------------------------------------------------------------------------
// Provider call helper
// ---------------------------------------------------------------------------

async function callProvider(
  adapter: import('../types.js').ProviderAdapter,
  promptFile: PromptFile,
  testCase: TestCase,
  model: string,
  userMessage: string,
): Promise<PromptResponse> {
  const callStart = Date.now();

  const chatResponse = await adapter.chat({
    model,
    system: promptFile.system,
    userMessage,
    temperature: promptFile.temperature,
    maxTokens: promptFile.maxTokens,
    topP: promptFile.topP,
  });

  const latencyMs = Date.now() - callStart;
  const cost = adapter.estimateCost(
    model,
    chatResponse.usage.promptTokens,
    chatResponse.usage.completionTokens,
  );

  return {
    content: chatResponse.content,
    model,
    provider: adapter.name,
    usage: chatResponse.usage,
    cost,
    latencyMs,
    finishReason: chatResponse.finishReason,
  };
}

// ---------------------------------------------------------------------------
// Assertion helpers for error / dry-run cases
// ---------------------------------------------------------------------------

function buildSkippedAssertions(
  testCase: TestCase,
  response: PromptResponse,
): AssertionResult[] {
  return testCase.assertions.map((assertion) => ({
    assertion,
    passed: false,
    message: 'Skipped (dry-run mode)',
    score: 0,
    durationMs: 0,
  }));
}

function buildErrorAssertions(
  testCase: TestCase,
  response: PromptResponse,
  errorMessage: string,
): AssertionResult[] {
  return testCase.assertions.map((assertion) => ({
    assertion,
    passed: false,
    message: `Provider error: ${errorMessage}`,
    score: 0,
    durationMs: 0,
  }));
}

// ---------------------------------------------------------------------------
// Result builders
// ---------------------------------------------------------------------------

function buildTestResult(
  promptName: string,
  testCase: TestCase,
  response: PromptResponse,
  assertions: AssertionResult[],
  testStart: number,
): TestResult {
  const passed = assertions.every((a) => a.passed);
  const score =
    assertions.length === 0
      ? 1
      : assertions.reduce((sum, a) => sum + a.score * (a.assertion.weight ?? 1), 0) /
        assertions.reduce((sum, a) => sum + (a.assertion.weight ?? 1), 0);

  return {
    testCase,
    promptName,
    response,
    assertions,
    passed,
    score,
    durationMs: Date.now() - testStart,
  };
}

function buildSummary(
  results: TestResult[],
  ctx: RunContext,
): import('../types.js').RunSummary {
  const totalTests = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = totalTests - passed;
  const avgScore = totalTests === 0 ? 0 : results.reduce((s, r) => s + r.score, 0) / totalTests;
  const totalCost = results.reduce((s, r) => s + r.response.cost, 0);
  const totalDurationMs = ctx.elapsedMs();
  const totalTokens = results.reduce((s, r) => s + r.response.usage.totalTokens, 0);

  return { totalTests, passed, failed, avgScore, totalCost, totalDurationMs, totalTokens };
}

// ---------------------------------------------------------------------------
// Timeout utility
// ---------------------------------------------------------------------------

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}
