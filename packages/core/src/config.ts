/**
 * Global config loader for promptci.config.yaml.
 * Searches cwd and parent directories. Supports ${ENV_VAR} interpolation.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { PromptCIConfigSchema } from './schema.js';
import type { PromptCIConfig } from './types.js';

const CONFIG_FILENAMES = ['promptci.config.yaml', 'promptci.config.yml'];

// ---------------------------------------------------------------------------
// ENV interpolation (same logic as loader, inlined to avoid circular dep)
// ---------------------------------------------------------------------------

function interpolateEnv(value: string): string {
  return value.replace(/\$\{([^}]+)\}/g, (_match, name: string) => {
    return process.env[name] ?? '';
  });
}

function walkEnv(node: unknown): unknown {
  if (typeof node === 'string') return interpolateEnv(node);
  if (Array.isArray(node)) return node.map(walkEnv);
  if (node !== null && typeof node === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      out[k] = walkEnv(v);
    }
    return out;
  }
  return node;
}

// ---------------------------------------------------------------------------
// Config file search
// ---------------------------------------------------------------------------

/** Walk up directory tree looking for a config file. Returns null if not found. */
function findConfigFile(startDir: string): string | null {
  let dir = startDir;
  while (true) {
    for (const name of CONFIG_FILENAMES) {
      const candidate = join(dir, name);
      if (existsSync(candidate)) return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) break; // filesystem root
    dir = parent;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

function defaultConfig(): PromptCIConfig {
  return {
    providers: {},
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load the PromptCI global config.
 *
 * @param configPath - Explicit path to config file. If omitted, searches cwd
 *                     and parent directories.
 * @returns Validated PromptCIConfig. Returns sensible defaults if no config
 *          file is found and configPath was not specified.
 */
export function loadConfig(configPath?: string): PromptCIConfig {
  let filePath: string | null = null;

  if (configPath) {
    filePath = resolve(configPath);
    if (!existsSync(filePath)) {
      throw new Error(`Config file not found: ${filePath}`);
    }
  } else {
    filePath = findConfigFile(process.cwd());
  }

  if (!filePath) {
    return defaultConfig();
  }

  const raw = readFileSync(filePath, 'utf-8');
  const parsed = parseYaml(raw) as unknown;
  const withEnv = walkEnv(parsed);
  const result = PromptCIConfigSchema.parse(withEnv);
  return result as PromptCIConfig;
}
