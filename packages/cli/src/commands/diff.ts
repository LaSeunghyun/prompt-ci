/**
 * `promptci diff <run1> <run2>` — compare two eval runs.
 */

import { Command } from 'commander';
import pc from 'picocolors';
import { loadConfig, createDatabase, diffRuns } from '@prompt-ci/core';

export function makeDiffCommand(): Command {
  return new Command('diff')
    .description('Compare two eval runs')
    .argument('<run1>', 'First run ID')
    .argument('<run2>', 'Second run ID')
    .option('--config <path>', 'Path to promptci.config.yaml')
    .action((run1Id: string, run2Id: string, opts: { config?: string }) => {
      try {
        const config = loadConfig(opts.config);
        const dbPath = config.storagePath
          ? `${config.storagePath}/history.db`
          : undefined;
        const db = createDatabase(dbPath);

        const diff = diffRuns(db, run1Id, run2Id);
        db.close();

        console.log(pc.bold('Diff: ') + pc.cyan(run1Id) + ' → ' + pc.cyan(run2Id));
        console.log('');

        // Summary line
        const s1 = diff.run1;
        const s2 = diff.run2;
        console.log(
          `Run 1: ${s1.passed}/${s1.totalTests} passed  score=${s1.avgScore.toFixed(2)}  cost=$${s1.totalCost.toFixed(4)}`,
        );
        console.log(
          `Run 2: ${s2.passed}/${s2.totalTests} passed  score=${s2.avgScore.toFixed(2)}  cost=$${s2.totalCost.toFixed(4)}`,
        );
        console.log('');

        if (diff.improved.length > 0) {
          console.log(pc.bold(pc.green(`Improved (${diff.improved.length}):`)));
          for (const name of diff.improved) {
            console.log('  ' + pc.green('+ ') + name);
          }
          console.log('');
        }

        if (diff.regressed.length > 0) {
          console.log(pc.bold(pc.red(`Regressed (${diff.regressed.length}):`)));
          for (const name of diff.regressed) {
            console.log('  ' + pc.red('- ') + name);
          }
          console.log('');
        }

        if (diff.unchanged.length > 0) {
          console.log(pc.bold(`Unchanged (${diff.unchanged.length}):`));
          for (const name of diff.unchanged) {
            console.log('  ' + pc.gray('= ') + name);
          }
          console.log('');
        }

        if (diff.improved.length === 0 && diff.regressed.length === 0) {
          console.log(pc.gray('No changes between runs.'));
        }
      } catch (err) {
        console.error(pc.red('Error: ') + (err as Error).message);
        process.exit(1);
      }
    });
}
