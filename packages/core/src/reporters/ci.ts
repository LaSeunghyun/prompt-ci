/**
 * CI annotations reporter - emits GitHub Actions workflow commands for failed tests.
 * Outputs ::error and ::warning annotation lines to stdout.
 */

import type { EvalRun } from '../types.js';
import type { Reporter } from './base.js';

export class CIReporter implements Reporter {
  report(run: EvalRun): void {
    for (const result of run.results) {
      if (result.passed) continue;

      const title = `Test failed: ${result.promptName} / ${result.testCase.name}`;

      // Collect failed assertion messages
      const failedAssertions = result.assertions.filter((a) => !a.passed);

      if (failedAssertions.length === 0) {
        // Overall failure with no specific assertion - emit a general error
        const message = encodeAnnotationValue(
          `Prompt: ${result.promptName} | Test: ${result.testCase.name} | Score: ${result.score.toFixed(3)}`,
        );
        process.stdout.write(
          `::error title=${encodeAnnotationValue(title)}::${message}\n`,
        );
        continue;
      }

      for (const assertion of failedAssertions) {
        const msg = assertion.message;
        const score = assertion.score;

        // Low score (< 0.5) → error, higher partial score → warning
        const level = score < 0.5 ? 'error' : 'warning';
        const annotationTitle = encodeAnnotationValue(
          `${result.promptName} / ${result.testCase.name} [${assertion.assertion.type}]`,
        );
        const annotationMsg = encodeAnnotationValue(msg);

        process.stdout.write(
          `::${level} title=${annotationTitle}::${annotationMsg}\n`,
        );
      }
    }

    // Summary line
    const { summary } = run;
    if (summary.failed > 0) {
      const msg = encodeAnnotationValue(
        `${summary.failed}/${summary.totalTests} tests failed. Avg score: ${summary.avgScore.toFixed(3)}. Total cost: $${summary.totalCost.toFixed(4)}.`,
      );
      process.stdout.write(`::error title=Eval Run Failed::${msg}\n`);
    }
  }
}

/** Encode special characters for GitHub Actions annotation values. */
function encodeAnnotationValue(value: string): string {
  return value
    .replace(/%/g, '%25')
    .replace(/\r/g, '%0D')
    .replace(/\n/g, '%0A')
    .replace(/:/g, '%3A')
    .replace(/,/g, '%2C');
}
