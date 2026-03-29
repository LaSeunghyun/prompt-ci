#!/usr/bin/env node
/**
 * Prompt CI/CD CLI entry point.
 */

import { Command } from 'commander';
import { makeInitCommand } from './commands/init.js';
import { makeRunCommand } from './commands/run.js';
import { makeDiffCommand } from './commands/diff.js';
import { makeHistoryCommand } from './commands/history.js';

const program = new Command();

program
  .name('promptci')
  .description('Prompt CI/CD — test, evaluate, and deploy LLM prompts')
  .version('0.1.0');

program.addCommand(makeInitCommand());
program.addCommand(makeRunCommand());
program.addCommand(makeDiffCommand());
program.addCommand(makeHistoryCommand());

program.parse();
