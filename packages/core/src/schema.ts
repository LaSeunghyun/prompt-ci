import { z } from 'zod';

// ---------------------------------------------------------------------------
// VariableDef schema
// ---------------------------------------------------------------------------

export const VariableDefSchema = z.union([
  z.string(),
  z.array(z.string()),
  z.object({
    default: z.string().optional(),
    source: z.enum(['env', 'file', 'arg']).optional(),
    required: z.boolean().optional(),
  }),
]);

// ---------------------------------------------------------------------------
// AssertionType schema
// ---------------------------------------------------------------------------

export const AssertionTypeSchema = z.enum([
  'contains',
  'not-contains',
  'regex',
  'not-regex',
  'json-schema',
  'is-json',
  'max-tokens',
  'cost-limit',
  'max-latency',
  'llm-judge',
  'similarity',
  'custom-fn',
]);

// ---------------------------------------------------------------------------
// Assertion schema
// ---------------------------------------------------------------------------

export const AssertionSchema = z.object({
  type: AssertionTypeSchema,
  value: z.unknown(),
  criteria: z.string().optional(),
  judge: z
    .object({
      provider: z.string().optional(),
      model: z.string().optional(),
    })
    .optional(),
  reference: z.string().optional(),
  fn: z.string().optional(),
  weight: z.number().optional(),
});

// ---------------------------------------------------------------------------
// TestCase schema
// ---------------------------------------------------------------------------

export const TestCaseSchema = z.object({
  name: z.string(),
  vars: z.record(z.string(), z.string()),
  model: z.string().optional(),
  assertions: z.array(AssertionSchema),
  timeoutMs: z.number().optional(),
});

// ---------------------------------------------------------------------------
// PromptFile schema
// ---------------------------------------------------------------------------

export const PromptFileSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  model: z.string(),
  provider: z.string().optional(),
  temperature: z.number().optional(),
  maxTokens: z.number().optional(),
  topP: z.number().optional(),
  system: z.string().optional(),
  template: z.string(),
  variables: z.record(z.string(), VariableDefSchema).optional(),
  tests: z.array(TestCaseSchema).optional(),
  tags: z.array(z.string()).optional(),
});

// ---------------------------------------------------------------------------
// ProviderSettings schema
// ---------------------------------------------------------------------------

export const ProviderSettingsSchema = z.object({
  apiKeyEnv: z.string().optional(),
  baseUrl: z.string().optional(),
});

// ---------------------------------------------------------------------------
// ReporterConfig schema
// ---------------------------------------------------------------------------

export const ReporterConfigSchema = z.union([
  z.enum(['console', 'json', 'html', 'markdown', 'ci']),
  z.object({
    type: z.enum(['json', 'html', 'markdown']),
    output: z.string(),
  }),
]);

// ---------------------------------------------------------------------------
// PromptCIConfig schema
// ---------------------------------------------------------------------------

export const PromptCIConfigSchema = z.object({
  defaultProvider: z.string().optional(),
  defaultModel: z.string().optional(),
  providers: z.record(z.string(), ProviderSettingsSchema),
  judge: z
    .object({
      provider: z.string().optional(),
      model: z.string().optional(),
    })
    .optional(),
  storagePath: z.string().optional(),
  concurrency: z.number().optional(),
  timeoutMs: z.number().optional(),
  reporters: z.array(ReporterConfigSchema).optional(),
});

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type PromptFileSchemaType = z.infer<typeof PromptFileSchema>;
export type PromptCIConfigSchemaType = z.infer<typeof PromptCIConfigSchema>;
export type TestCaseSchemaType = z.infer<typeof TestCaseSchema>;
export type AssertionSchemaType = z.infer<typeof AssertionSchema>;
export type VariableDefSchemaType = z.infer<typeof VariableDefSchema>;
