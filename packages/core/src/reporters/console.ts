/**
 * Console reporter - colorful terminal output using ANSI escape codes.
 */

import type { EvalRun } from '../types.js';
import type { Reporter } from './base.js';

// ANSI color codes
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const WHITE = '\x1b[37m';
const BG_GREEN = '\x1b[42m';
const BG_RED = '\x1b[41m';

function green(s: string): string { return `${GREEN}${s}${RESET}`; }
function red(s: string): string { return `${RED}${s}${RESET}`; }
function yellow(s: string): string { return `${YELLOW}${s}${RESET}`; }
function cyan(s: string): string { return `${CYAN}${s}${RESET}`; }
function bold(s: string): string { return `${BOLD}${s}${RESET}`; }
function dim(s: string): string { return `${DIM}${s}${RESET}`; }
function passBadge(): string { return `${BG_GREEN}\x1b[30m PASS ${RESET}`; }
function failBadge(): string { return `${BG_RED}\x1b[97m FAIL ${RESET}`; }

export class ConsoleReporter implements Reporter {
  report(run: EvalRun): void {
    const lines: string[] = [];

    lines.push('');
    lines.push(bold(cyan('══════════════════════════════════════════════════')));
    lines.push(bold(cyan('  Prompt CI Eval Run')));
    lines.push(bold(cyan('══════════════════════════════════════════════════')));
    lines.push(dim(`  Run ID : ${run.id}`));
    lines.push(dim(`  Started: ${run.startedAt}`));
    if (run.gitBranch) lines.push(dim(`  Branch : ${run.gitBranch}`));
    if (run.gitRef)    lines.push(dim(`  Ref    : ${run.gitRef}`));
    lines.push('');

    // Group results by prompt name
    const byPrompt = new Map<string, typeof run.results>();
    for (const result of run.results) {
      const existing = byPrompt.get(result.promptName) ?? [];
      existing.push(result);
      byPrompt.set(result.promptName, existing);
    }

    for (const [promptName, results] of byPrompt) {
      lines.push(bold(`  ${WHITE}▸ ${promptName}${RESET}`));

      for (const result of results) {
        const badge = result.passed ? passBadge() : failBadge();
        const score = result.score >= 0.8
          ? green(`score=${result.score.toFixed(3)}`)
          : result.score >= 0.5
            ? yellow(`score=${result.score.toFixed(3)}`)
            : red(`score=${result.score.toFixed(3)}`);
        const cost = dim(`$${result.response.cost.toFixed(4)}`);
        const latency = dim(`${result.response.latencyMs}ms`);
        const model = dim(result.response.model);

        lines.push(
          `    ${badge} ${result.testCase.name}  ${score}  ${cost}  ${latency}  ${model}`,
        );

        // Show failed assertion messages
        for (const assertion of result.assertions) {
          if (!assertion.passed) {
            lines.push(
              `         ${red('✗')} [${assertion.assertion.type}] ${assertion.message}`,
            );
            if (assertion.reasoning) {
              lines.push(`           ${dim(assertion.reasoning)}`);
            }
          }
        }
      }
      lines.push('');
    }

    // Summary
    const { summary } = run;
    const passRate =
      summary.totalTests > 0
        ? ((summary.passed / summary.totalTests) * 100).toFixed(1)
        : '0.0';
    const allPassed = summary.failed === 0;

    lines.push(bold(cyan('──────────────────────────────────────────────────')));
    lines.push(bold('  Summary'));
    lines.push(cyan('──────────────────────────────────────────────────'));

    const passedStr = allPassed ? green(`${summary.passed}`) : green(`${summary.passed}`);
    const failedStr = summary.failed > 0 ? red(`${summary.failed}`) : dim(`${summary.failed}`);
    const rateColor = allPassed ? green : summary.failed / summary.totalTests < 0.3 ? yellow : red;

    lines.push(`  Tests   : ${passedStr}${dim('/')}${summary.totalTests} passed  ${failedStr} failed  ${rateColor(passRate + '%')}`);
    lines.push(`  Score   : ${summary.avgScore.toFixed(3)} avg`);
    lines.push(`  Cost    : $${summary.totalCost.toFixed(4)}`);
    lines.push(`  Time    : ${(summary.totalDurationMs / 1000).toFixed(2)}s  (${summary.totalTokens.toLocaleString()} tokens)`);
    lines.push('');

    if (allPassed) {
      lines.push(bold(green('  All tests passed!')));
    } else {
      lines.push(bold(red(`  ${summary.failed} test(s) failed.`)));
    }
    lines.push('');

    process.stdout.write(lines.join('\n'));
  }
}
