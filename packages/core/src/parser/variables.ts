/**
 * Variable resolution with layered precedence:
 *   prompt defaults < test case vars < CLI args < env vars (PROMPTCI_VAR_*)
 */

import type { PromptFile, TestCase, VariableDef } from '../types.js';

export class VariableResolutionError extends Error {
  constructor(public readonly missing: string[]) {
    super(`Missing required variable(s): ${missing.join(', ')}`);
    this.name = 'VariableResolutionError';
  }
}

/**
 * Extract the default string value from a VariableDef, if any.
 */
function getDefaultValue(def: VariableDef): string | undefined {
  if (typeof def === 'string') return def;
  if (Array.isArray(def)) return def[0]; // first element as default
  return def.default;
}

/**
 * Determine whether a variable is marked required.
 */
function isRequired(def: VariableDef): boolean {
  if (typeof def === 'string' || Array.isArray(def)) return false;
  return def.required === true;
}

/**
 * Resolve all variables for a prompt file + test case combination.
 *
 * Resolution order (later layers win):
 *   1. Prompt-level defaults (variables[].default)
 *   2. Test case vars
 *   3. CLI args (cliVars)
 *   4. Environment variables prefixed with PROMPTCI_VAR_
 */
export function resolveVariables(
  promptFile: PromptFile,
  testCase: TestCase,
  cliVars?: Record<string, string>,
): Record<string, string> {
  const resolved: Record<string, string> = {};

  // Layer 1: prompt defaults
  if (promptFile.variables) {
    for (const [key, def] of Object.entries(promptFile.variables)) {
      const defaultVal = getDefaultValue(def);
      if (defaultVal !== undefined) {
        resolved[key] = defaultVal;
      }
    }
  }

  // Layer 2: test case vars
  for (const [key, val] of Object.entries(testCase.vars)) {
    resolved[key] = val;
  }

  // Layer 3: CLI args
  if (cliVars) {
    for (const [key, val] of Object.entries(cliVars)) {
      resolved[key] = val;
    }
  }

  // Layer 4: environment variables (PROMPTCI_VAR_<NAME>)
  for (const [envKey, envVal] of Object.entries(process.env)) {
    if (envKey.startsWith('PROMPTCI_VAR_') && envVal !== undefined) {
      const varName = envKey.slice('PROMPTCI_VAR_'.length);
      // convert UPPER_SNAKE to camelCase is NOT done — use exact name after prefix
      resolved[varName] = envVal;
    }
  }

  // Validate required variables
  if (promptFile.variables) {
    const missing: string[] = [];
    for (const [key, def] of Object.entries(promptFile.variables)) {
      if (isRequired(def) && !(key in resolved)) {
        missing.push(key);
      }
    }
    if (missing.length > 0) {
      throw new VariableResolutionError(missing);
    }
  }

  return resolved;
}
