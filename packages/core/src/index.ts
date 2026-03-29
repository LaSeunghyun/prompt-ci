/**
 * Public barrel export for @prompt-ci/core.
 */

// Types
export type {
  PromptFile,
  VariableDef,
  TestCase,
  AssertionType,
  Assertion,
  TokenUsage,
  PromptResponse,
  AssertionResult,
  TestResult,
  RunSummary,
  EvalRun,
  ChatRequest,
  ChatResponse,
  ProviderAdapter,
  ProviderSettings,
  ReporterConfig,
  PromptCIConfig,
} from './types.js';

// Parser
export { loadPromptFile, loadPromptFiles } from './parser/loader.js';
export { interpolate, InterpolationError } from './parser/interpolator.js';
export { resolveVariables, VariableResolutionError } from './parser/variables.js';

// Config
export { loadConfig } from './config.js';

// Providers
export { ProviderRegistry, createDefaultRegistry } from './providers/registry.js';

// Runner
export { runEval } from './runner/executor.js';
export type { RunOptions } from './runner/executor.js';

// Assertions
export { evaluateAssertion } from './assertions/engine.js';

// Reporters
export type { Reporter } from './reporters/base.js';
export { ConsoleReporter } from './reporters/console.js';
export { JsonReporter } from './reporters/json.js';
export { HtmlReporter } from './reporters/html.js';
export { MarkdownReporter } from './reporters/markdown.js';
export { CIReporter } from './reporters/ci.js';

// Store
export { createDatabase } from './store/db.js';
export { saveRun, getRun, listRuns, diffRuns } from './store/history.js';
export type { RunDiff } from './store/history.js';

// Retry
export { withRetry } from './runner/retry.js';
