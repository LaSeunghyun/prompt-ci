import { describe, it, expect } from 'vitest';
import {
  PromptFileSchema,
  TestCaseSchema,
  AssertionSchema,
  VariableDefSchema,
} from '../schema.js';

// -----------------------------------------------------------------------
// PromptFileSchema
// -----------------------------------------------------------------------

describe('PromptFileSchema', () => {
  const validPromptFile = {
    name: 'my-prompt',
    model: 'gpt-4o',
    template: 'Hello, {{name}}!',
  };

  it('accepts a minimal valid PromptFile', () => {
    const result = PromptFileSchema.safeParse(validPromptFile);
    expect(result.success).toBe(true);
  });

  it('accepts a fully-populated PromptFile', () => {
    const full = {
      ...validPromptFile,
      description: 'A greeting prompt',
      provider: 'openai',
      temperature: 0.7,
      maxTokens: 256,
      topP: 0.9,
      system: 'You are helpful.',
      variables: { name: 'Alice' },
      tests: [
        {
          name: 'basic test',
          vars: { name: 'Bob' },
          assertions: [{ type: 'contains', value: 'Bob' }],
        },
      ],
      tags: ['greeting', 'demo'],
    };
    expect(PromptFileSchema.safeParse(full).success).toBe(true);
  });

  it('fails when name is missing', () => {
    const { name: _, ...noName } = validPromptFile;
    expect(PromptFileSchema.safeParse(noName).success).toBe(false);
  });

  it('fails when model is missing', () => {
    const { model: _, ...noModel } = validPromptFile;
    expect(PromptFileSchema.safeParse(noModel).success).toBe(false);
  });

  it('fails when template is missing', () => {
    const { template: _, ...noTemplate } = validPromptFile;
    expect(PromptFileSchema.safeParse(noTemplate).success).toBe(false);
  });

  it('fails when temperature is not a number', () => {
    const bad = { ...validPromptFile, temperature: 'hot' };
    expect(PromptFileSchema.safeParse(bad).success).toBe(false);
  });
});

// -----------------------------------------------------------------------
// TestCaseSchema
// -----------------------------------------------------------------------

describe('TestCaseSchema', () => {
  const validTestCase = {
    name: 'simple case',
    vars: { lang: 'en' },
    assertions: [{ type: 'contains', value: 'hello' }],
  };

  it('accepts a valid TestCase', () => {
    expect(TestCaseSchema.safeParse(validTestCase).success).toBe(true);
  });

  it('accepts optional model and timeoutMs fields', () => {
    const tc = { ...validTestCase, model: 'claude-3-5-haiku', timeoutMs: 5000 };
    expect(TestCaseSchema.safeParse(tc).success).toBe(true);
  });

  it('fails when name is missing', () => {
    const { name: _, ...noName } = validTestCase;
    expect(TestCaseSchema.safeParse(noName).success).toBe(false);
  });

  it('fails when vars is not a string-to-string record', () => {
    const bad = { ...validTestCase, vars: { key: 123 } };
    expect(TestCaseSchema.safeParse(bad).success).toBe(false);
  });

  it('fails when assertions is missing', () => {
    const { assertions: _, ...noAssertions } = validTestCase;
    expect(TestCaseSchema.safeParse(noAssertions).success).toBe(false);
  });
});

// -----------------------------------------------------------------------
// AssertionSchema
// -----------------------------------------------------------------------

describe('AssertionSchema', () => {
  it('accepts a contains assertion', () => {
    expect(
      AssertionSchema.safeParse({ type: 'contains', value: 'hello' }).success,
    ).toBe(true);
  });

  it('accepts a not-contains assertion', () => {
    expect(
      AssertionSchema.safeParse({ type: 'not-contains', value: 'error' }).success,
    ).toBe(true);
  });

  it('accepts a regex assertion', () => {
    expect(
      AssertionSchema.safeParse({ type: 'regex', value: '\\d+' }).success,
    ).toBe(true);
  });

  it('accepts a not-regex assertion', () => {
    expect(
      AssertionSchema.safeParse({ type: 'not-regex', value: 'spam' }).success,
    ).toBe(true);
  });

  it('accepts a json-schema assertion', () => {
    expect(
      AssertionSchema.safeParse({
        type: 'json-schema',
        value: { type: 'object' },
      }).success,
    ).toBe(true);
  });

  it('accepts an is-json assertion', () => {
    expect(
      AssertionSchema.safeParse({ type: 'is-json', value: null }).success,
    ).toBe(true);
  });

  it('accepts a max-tokens assertion', () => {
    expect(
      AssertionSchema.safeParse({ type: 'max-tokens', value: 100 }).success,
    ).toBe(true);
  });

  it('accepts a cost-limit assertion', () => {
    expect(
      AssertionSchema.safeParse({ type: 'cost-limit', value: 0.01 }).success,
    ).toBe(true);
  });

  it('accepts an llm-judge assertion with optional criteria', () => {
    expect(
      AssertionSchema.safeParse({
        type: 'llm-judge',
        value: null,
        criteria: 'Is the response helpful?',
      }).success,
    ).toBe(true);
  });

  it('accepts a similarity assertion with optional reference', () => {
    expect(
      AssertionSchema.safeParse({
        type: 'similarity',
        value: 0.8,
        reference: 'expected text',
      }).success,
    ).toBe(true);
  });

  it('accepts a custom-fn assertion with optional fn field', () => {
    expect(
      AssertionSchema.safeParse({
        type: 'custom-fn',
        value: null,
        fn: './my-check.js',
      }).success,
    ).toBe(true);
  });

  it('fails when type is not a recognised assertion type', () => {
    expect(
      AssertionSchema.safeParse({ type: 'unknown-type', value: 'x' }).success,
    ).toBe(false);
  });

  it('fails when type field is missing', () => {
    expect(AssertionSchema.safeParse({ value: 'hello' }).success).toBe(false);
  });
});

// -----------------------------------------------------------------------
// VariableDefSchema
// -----------------------------------------------------------------------

describe('VariableDefSchema', () => {
  it('accepts a plain string def', () => {
    expect(VariableDefSchema.safeParse('hello').success).toBe(true);
  });

  it('accepts an array of strings def', () => {
    expect(VariableDefSchema.safeParse(['en', 'fr']).success).toBe(true);
  });

  it('accepts an object def with default', () => {
    expect(
      VariableDefSchema.safeParse({ default: 'en', required: false }).success,
    ).toBe(true);
  });

  it('accepts an object def with required=true and no default', () => {
    expect(
      VariableDefSchema.safeParse({ required: true }).success,
    ).toBe(true);
  });

  it('accepts an object def with source field', () => {
    expect(
      VariableDefSchema.safeParse({ source: 'env', required: true }).success,
    ).toBe(true);
  });

  it('fails when object def has an invalid source value', () => {
    expect(
      VariableDefSchema.safeParse({ source: 'database' }).success,
    ).toBe(false);
  });
});
