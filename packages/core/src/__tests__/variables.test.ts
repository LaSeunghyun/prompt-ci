import { describe, it, expect, afterEach } from 'vitest';
import { resolveVariables, VariableResolutionError } from '../parser/variables.js';
import type { PromptFile, TestCase } from '../types.js';

// Minimal helpers to construct test fixtures cleanly
function makePromptFile(overrides: Partial<PromptFile> = {}): PromptFile {
  return {
    name: 'test-prompt',
    model: 'gpt-4o',
    template: 'Hello {{name}}',
    ...overrides,
  };
}

function makeTestCase(vars: Record<string, string> = {}): TestCase {
  return { name: 'case', vars, assertions: [] };
}

describe('resolveVariables', () => {
  // Clean up any env vars set during tests
  const envKeysSet: string[] = [];
  afterEach(() => {
    for (const key of envKeysSet) {
      delete process.env[key];
    }
    envKeysSet.length = 0;
  });

  function setEnv(key: string, value: string) {
    process.env[key] = value;
    envKeysSet.push(key);
  }

  it('layer 1: uses prompt-level string default when no other source provides a value', () => {
    const prompt = makePromptFile({ variables: { name: 'DefaultName' } });
    const result = resolveVariables(prompt, makeTestCase(), {});
    expect(result.name).toBe('DefaultName');
  });

  it('layer 1: uses first element of array def as default', () => {
    const prompt = makePromptFile({ variables: { lang: ['en', 'fr', 'de'] } });
    const result = resolveVariables(prompt, makeTestCase(), {});
    expect(result.lang).toBe('en');
  });

  it('layer 1: uses object def default field', () => {
    const prompt = makePromptFile({
      variables: { tone: { default: 'friendly', source: 'arg' } },
    });
    const result = resolveVariables(prompt, makeTestCase(), {});
    expect(result.tone).toBe('friendly');
  });

  it('layer 2: test case vars override prompt defaults', () => {
    const prompt = makePromptFile({ variables: { name: 'DefaultName' } });
    const tc = makeTestCase({ name: 'CaseName' });
    const result = resolveVariables(prompt, tc, {});
    expect(result.name).toBe('CaseName');
  });

  it('layer 3: CLI vars override test case vars', () => {
    const prompt = makePromptFile({ variables: { name: 'DefaultName' } });
    const tc = makeTestCase({ name: 'CaseName' });
    const result = resolveVariables(prompt, tc, { name: 'CLIName' });
    expect(result.name).toBe('CLIName');
  });

  it('layer 4: PROMPTCI_VAR_* env vars override CLI vars', () => {
    setEnv('PROMPTCI_VAR_name', 'EnvName');
    const prompt = makePromptFile({ variables: { name: 'DefaultName' } });
    const tc = makeTestCase({ name: 'CaseName' });
    const result = resolveVariables(prompt, tc, { name: 'CLIName' });
    expect(result.name).toBe('EnvName');
  });

  it('layer 4: env var key uses the exact suffix after PROMPTCI_VAR_', () => {
    setEnv('PROMPTCI_VAR_my_key', 'env-value');
    const prompt = makePromptFile({ variables: { my_key: 'default' } });
    const result = resolveVariables(prompt, makeTestCase(), {});
    expect(result['my_key']).toBe('env-value');
  });

  it('throws VariableResolutionError when a required variable has no value', () => {
    const prompt = makePromptFile({
      variables: { secret: { required: true } },
    });
    expect(() => resolveVariables(prompt, makeTestCase(), {})).toThrow(
      VariableResolutionError,
    );
  });

  it('VariableResolutionError lists the missing variable name', () => {
    const prompt = makePromptFile({
      variables: { apiKey: { required: true } },
    });
    expect(() => resolveVariables(prompt, makeTestCase(), {})).toThrow(
      'apiKey',
    );
  });

  it('does NOT throw when a required variable is supplied via test case', () => {
    const prompt = makePromptFile({
      variables: { secret: { required: true } },
    });
    const tc = makeTestCase({ secret: 'provided' });
    expect(() => resolveVariables(prompt, tc, {})).not.toThrow();
  });

  it('isRequired: string def is not required', () => {
    const prompt = makePromptFile({ variables: { name: 'default' } });
    // No value supplied at all — should NOT throw
    expect(() =>
      resolveVariables(
        { ...prompt, variables: { extra: 'val' } },
        makeTestCase(),
        {},
      ),
    ).not.toThrow();
  });

  it('isRequired: array def is not required', () => {
    const prompt = makePromptFile({ variables: { items: ['a', 'b'] } });
    expect(() => resolveVariables(prompt, makeTestCase(), {})).not.toThrow();
  });

  it('isRequired: object def with required=true IS required', () => {
    const prompt = makePromptFile({
      variables: { token: { required: true } },
    });
    expect(() => resolveVariables(prompt, makeTestCase(), {})).toThrow(
      VariableResolutionError,
    );
  });

  it('resolves nothing when promptFile has no variables field', () => {
    const prompt = makePromptFile({ variables: undefined });
    const result = resolveVariables(prompt, makeTestCase({ x: '1' }), {});
    expect(result).toEqual({ x: '1' });
  });
});
