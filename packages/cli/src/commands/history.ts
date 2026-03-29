/**
 * `promptci history` — list past eval runs.
 */

import { Command } from 'commander';
import pc from 'picocolors';
import { loadConfig, createDatabase, listRuns } from '@prompt-ci/core';
import { renderTable } from '../formatters/table.js';

export function makeHistoryCommand(): Command {
  return new Command('history')
    .description('List past eval runs')
    .option('-l, --limit <n>', 'Number of runs to show', '20')
    .option('--config <path>', 'Path to promptci.config.yaml')
    .action((opts: { limit: string; config?: string }) => {
      try {
        const config = loadConfig(opts.config);
        const dbPath = config.storagePath
          ? `${config.storagePath}/history.db`
          : undefined;
        const db = createDatabase(dbPath);

        const limit = parseInt(opts.limit, 10);
        const runs = listRuns(db, limit);
        db.close();

        if (runs.length === 0) {
          console.log(pc.gray('No eval runs found. Run `promptci run` to get started.'));
          return;
        }

        const headers = ['ID', 'Date', 'Passed/Total', 'Score', 'Cost', 'Duration'];
        const rows = runs.map((run) => {
          const date = new Date(run.startedAt).toLocaleString();
          const passedTotal = `${run.summary.passed}/${run.summary.totalTests}`;
          const score = run.summary.avgScore.toFixed(2);
          const cost = `$${run.summary.totalCost.toFixed(4)}`;
          const durationSec = (run.summary.totalDurationMs / 1000).toFixed(1) + 's';
          return [run.id, date, passedTotal, score, cost, durationSec];
        });

        console.log(renderTable(headers, rows));
        console.log(`Showing ${runs.length} run(s).`);
      } catch (err) {
        console.error(pc.red('Error: ') + (err as Error).message);
        process.exit(1);
      }
    });
}
