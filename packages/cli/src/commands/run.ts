/**
 * `promptci run [glob]` — run prompt evaluations.
 */

import { Command } from 'commander';
import pc from 'picocolors';
import {
  loadConfig,
  loadPromptFiles,
  runEval,
  createDatabase,
  saveRun,
  ConsoleReporter,
  JsonReporter,
  HtmlReporter,
  MarkdownReporter,
  CIReporter,
} from '@prompt-ci/core';
import type { Reporter } from '@prompt-ci/core';
import { createProgress } from '../formatters/progress.js';

const DEFAULT_GLOB = 'prompts/**/*.prompt.yaml';

export function makeRunCommand(): Command {
  return new Command('run')
    .description('Run prompt evaluations')
    .argument('[glob]', 'Glob pattern for prompt files', DEFAULT_GLOB)
    .option('-c, --concurrency <n>', 'Max concurrent test executions', '5')
    .option('-t, --timeout <ms>', 'Per-test timeout in milliseconds', '30000')
    .option('--dry-run', 'Estimate cost without calling providers')
    .option('--filter <regex>', 'Only run tests whose name matches regex')
    .option(
      '--reporter <type>',
      'Reporter type: console|json|html|markdown|ci (repeatable)',
      (val: string, prev: string[]) => [...prev, val],
      [] as string[],
    )
    .option('--output <path>', 'Output path for json/html/markdown reporters')
    .option('--config <path>', 'Path to promptci.config.yaml')
    .action(async (glob: string, opts: {
      concurrency: string;
      timeout: string;
      dryRun?: boolean;
      filter?: string;
      reporter: string[];
      output?: string;
      config?: string;
    }) => {
      try {
        // 1. Load config
        const config = loadConfig(opts.config);

        // 2. Load prompt files
        const promptFiles = await loadPromptFiles(glob);
        if (promptFiles.length === 0) {
          console.error(pc.yellow('No prompt files found matching: ') + glob);
          process.exit(1);
        }

        const totalTests = promptFiles.reduce(
          (sum, pf) => sum + (pf.tests?.length ?? 0),
          0,
        );

        if (opts.dryRun) {
          console.log(pc.cyan('Dry run mode — no API calls will be made'));
        }
        console.log(
          `Running ${pc.bold(String(totalTests))} tests across ${pc.bold(String(promptFiles.length))} prompts...`,
        );

        const progress = createProgress(totalTests);

        // 3. Run eval
        const run = await runEval(promptFiles, config, {
          concurrency: parseInt(opts.concurrency, 10),
          timeoutMs: parseInt(opts.timeout, 10),
          dryRun: opts.dryRun ?? false,
          filter: opts.filter,
          onTestComplete: (_result, current, _total) => {
            progress.update(current);
          },
        });

        progress.done();

        // 4. Resolve reporters
        const reporterTypes = opts.reporter.length > 0 ? opts.reporter : ['console'];
        const reporters: Reporter[] = reporterTypes.map((type) => {
          switch (type) {
            case 'json':
              return new JsonReporter(opts.output);
            case 'html':
              return new HtmlReporter();
            case 'markdown':
              return new MarkdownReporter();
            case 'ci':
              return new CIReporter();
            case 'console':
            default:
              return new ConsoleReporter();
          }
        });

        for (const reporter of reporters) {
          reporter.report(run);
        }

        // 5. Save to history DB
        const dbPath = config.storagePath
          ? `${config.storagePath}/history.db`
          : undefined;
        const db = createDatabase(dbPath);
        saveRun(db, run);
        db.close();

        // 6. Exit with appropriate code
        const allPassed = run.summary.failed === 0;
        if (!allPassed) {
          process.exit(1);
        }
      } catch (err) {
        console.error(pc.red('Error: ') + (err as Error).message);
        process.exit(1);
      }
    });
}
