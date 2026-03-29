/**
 * JSON reporter - serializes the full EvalRun as formatted JSON.
 * Optionally writes to a file if an output path is configured.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { EvalRun } from '../types.js';
import type { Reporter } from './base.js';

export class JsonReporter implements Reporter {
  constructor(private readonly outputPath?: string) {}

  report(run: EvalRun): string {
    const json = JSON.stringify(run, null, 2);

    if (this.outputPath) {
      mkdirSync(dirname(this.outputPath), { recursive: true });
      writeFileSync(this.outputPath, json, 'utf-8');
    }

    return json;
  }
}
