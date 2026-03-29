/**
 * YAML prompt file loader with ${ENV_VAR} interpolation and glob-based
 * multi-file loading.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, extname, sep } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { PromptFileSchema } from '../schema.js';
import type { PromptFile } from '../types.js';

// ---------------------------------------------------------------------------
// ENV interpolation
// ---------------------------------------------------------------------------

/** Replace ${ENV_VAR} placeholders with process.env values. */
function interpolateEnv(value: string): string {
  return value.replace(/\$\{([^}]+)\}/g, (_match, name: string) => {
    return process.env[name] ?? '';
  });
}

/** Recursively walk an unknown value and apply env interpolation to strings. */
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
// Single file loader
// ---------------------------------------------------------------------------

/**
 * Load and validate a single YAML prompt file.
 * Throws ZodError on validation failure or on YAML parse errors.
 */
export function loadPromptFile(filePath: string): PromptFile {
  const absPath = resolve(filePath);
  const raw = readFileSync(absPath, 'utf-8');
  const parsed = parseYaml(raw) as unknown;
  const withEnv = walkEnv(parsed);
  const result = PromptFileSchema.parse(withEnv);
  return result as PromptFile;
}

// ---------------------------------------------------------------------------
// Glob-based multi-file loader (no external glob lib)
// ---------------------------------------------------------------------------

/**
 * Minimal glob matching supporting:
 *   - `**` to match any number of path segments
 *   - `*`  to match any characters within a single segment
 *   - `?`  to match a single character within a segment
 */
function globToRegex(pattern: string): RegExp {
  // Normalise separators
  const normalised = pattern.replace(/\\/g, '/');
  let regex = '';
  let i = 0;
  while (i < normalised.length) {
    const ch = normalised[i];
    if (ch === '*' && normalised[i + 1] === '*') {
      // ** — match any path including slashes
      regex += '.*';
      i += 2;
      // consume optional trailing slash
      if (normalised[i] === '/') i++;
    } else if (ch === '*') {
      // * — match anything except slash
      regex += '[^/]*';
      i++;
    } else if (ch === '?') {
      regex += '[^/]';
      i++;
    } else if ('.+^${}()|[]\\'.includes(ch)) {
      regex += '\\' + ch;
      i++;
    } else {
      regex += ch;
      i++;
    }
  }
  return new RegExp('^' + regex + '$');
}

/** Recursively collect all files under a directory. */
function collectFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...collectFiles(full));
    } else {
      results.push(full);
    }
  }
  return results;
}

/**
 * Load all YAML prompt files matching the given glob pattern.
 * The pattern is resolved relative to cwd.
 */
export function loadPromptFiles(globPattern: string): PromptFile[] {
  // Determine the non-glob prefix as the base directory to scan
  const normalised = globPattern.replace(/\\/g, '/');
  const firstWild = normalised.search(/[*?]/);
  const prefixPath = firstWild === -1 ? normalised : normalised.slice(0, normalised.lastIndexOf('/', firstWild));
  const baseDir = resolve(prefixPath || '.');

  // Path traversal protection: reject patterns that escape cwd
  const cwd = process.cwd();
  const normBase = baseDir.replace(/\\/g, '/');
  const normCwd = cwd.replace(/\\/g, '/');
  if (!normBase.startsWith(normCwd + '/') && normBase !== normCwd) {
    throw new Error(
      `Glob pattern escapes working directory: "${globPattern}" resolves to "${baseDir}"`,
    );
  }

  const re = globToRegex(resolve(normalised).replace(/\\/g, '/'));
  const allFiles = collectFiles(baseDir);

  const matched = allFiles.filter((f) => re.test(f.replace(/\\/g, '/')));

  const results: PromptFile[] = [];
  for (const file of matched) {
    const ext = extname(file).toLowerCase();
    if (ext !== '.yaml' && ext !== '.yml') continue;
    results.push(loadPromptFile(file));
  }
  return results;
}
