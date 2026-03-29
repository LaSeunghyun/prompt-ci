/**
 * Core type definitions for the Prompt CI/CD system.
 */

// ---------------------------------------------------------------------------
// Prompt File Schema
// ---------------------------------------------------------------------------

export interface PromptFile {
  name: string;
  description?: string;
  model: string;
  provider?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  system?: string;
  template: string;
  variables?: Record<string, VariableDef>;
  tests?: TestCase[];
  tags?: string[];
}

export type VariableDef =
  | string
  | string[]
  | { default?: string; source?: 'env' | 'file' | 'arg'; required?: boolean };

export interface TestCase {
  name: string;
  vars: Record<string, string>;
  model?: string;
  assertions: Assertion[];
  timeoutMs?: number;
}

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

export type AssertionType =
  | 'contains'
  | 'not-contains'
  | 'regex'
  | 'not-regex'
  | 'json-schema'
  | 'is-json'
  | 'max-tokens'
  | 'cost-limit'
  | 'max-latency'
  | 'llm-judge'
  | 'similarity'
  | 'custom-fn';

export interface Assertion {
  type: AssertionType;
  value: unknown;
  criteria?: string;
  judge?: { provider?: string; model?: string };
  reference?: string;
  fn?: string;
  weight?: number;
}

// ---------------------------------------------------------------------------
// Execution Results
// ---------------------------------------------------------------------------

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface PromptResponse {
  content: string;
  model: string;
  provider: string;
  usage: TokenUsage;
  cost: number;
  latencyMs: number;
  finishReason: string;
}

export interface AssertionResult {
  assertion: Assertion;
  passed: boolean;
  message: string;
  reasoning?: string;
  score: number;
  durationMs: number;
}

export interface TestResult {
  testCase: TestCase;
  promptName: string;
  response: PromptResponse;
  assertions: AssertionResult[];
  passed: boolean;
  score: number;
  durationMs: number;
}

export interface RunSummary {
  totalTests: number;
  passed: number;
  failed: number;
  avgScore: number;
  totalCost: number;
  totalDurationMs: number;
  totalTokens: number;
}

export interface EvalRun {
  id: string;
  startedAt: string;
  finishedAt: string;
  gitRef?: string;
  gitBranch?: string;
  results: TestResult[];
  summary: RunSummary;
}

// ---------------------------------------------------------------------------
// Provider Adapter
// ---------------------------------------------------------------------------

export interface ChatRequest {
  model: string;
  system?: string;
  userMessage: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

export interface ChatResponse {
  content: string;
  usage: TokenUsage;
  finishReason: string;
}

export interface ProviderAdapter {
  readonly name: string;
  chat(request: ChatRequest): Promise<ChatResponse>;
  estimateCost(model: string, inputTokens: number, outputTokens: number): number;
}

// ---------------------------------------------------------------------------
// Global Config
// ---------------------------------------------------------------------------

export interface ProviderSettings {
  apiKeyEnv?: string;
  baseUrl?: string;
}

export type ReporterConfig =
  | 'console'
  | 'json'
  | 'html'
  | 'markdown'
  | 'ci'
  | { type: 'json' | 'html' | 'markdown'; output: string };

export interface PromptCIConfig {
  defaultProvider?: string;
  defaultModel?: string;
  providers: Record<string, ProviderSettings>;
  judge?: { provider?: string; model?: string };
  storagePath?: string;
  concurrency?: number;
  timeoutMs?: number;
  reporters?: ReporterConfig[];
}
