import type { EvalRun } from '../types.js';

export interface Reporter {
  report(run: EvalRun): string | void;
}
