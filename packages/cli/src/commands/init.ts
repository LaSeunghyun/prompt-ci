/**
 * `promptci init` — scaffold a new Prompt CI/CD project.
 */

import { Command } from 'commander';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import pc from 'picocolors';

const CONFIG_YAML = `# Prompt CI/CD configuration
# See https://github.com/your-org/prompt-ci for full docs

defaultProvider: openai
defaultModel: gpt-4o-mini

providers:
  openai:
    apiKeyEnv: OPENAI_API_KEY
  anthropic:
    apiKeyEnv: ANTHROPIC_API_KEY

concurrency: 5
timeoutMs: 30000

reporters:
  - console
`;

const EXAMPLE_PROMPT_YAML = `# Example prompt file
name: example
description: A simple greeting prompt
model: gpt-4o-mini
provider: openai
temperature: 0.7

system: You are a helpful assistant. Be concise and friendly.

template: |
  Hello! My name is {{name}} and I am a {{role}}.
  Please greet me and tell me one interesting fact about my role.

variables:
  name:
    required: true
  role:
    required: true

tests:
  - name: greet software engineer
    vars:
      name: Alice
      role: software engineer
    assertions:
      - type: contains
        value: Alice
      - type: max-tokens
        value: 200

  - name: greet data scientist
    vars:
      name: Bob
      role: data scientist
    assertions:
      - type: contains
        value: Bob
      - type: max-tokens
        value: 200
`;

export function makeInitCommand(): Command {
  return new Command('init')
    .description('Scaffold a new Prompt CI/CD project')
    .action(() => {
      const cwd = process.cwd();

      // Write promptci.config.yaml
      const configPath = join(cwd, 'promptci.config.yaml');
      if (existsSync(configPath)) {
        console.log(pc.yellow('  skip  ') + 'promptci.config.yaml already exists');
      } else {
        writeFileSync(configPath, CONFIG_YAML, 'utf-8');
        console.log(pc.green('  create') + ' promptci.config.yaml');
      }

      // Create prompts/ directory
      const promptsDir = join(cwd, 'prompts');
      if (!existsSync(promptsDir)) {
        mkdirSync(promptsDir, { recursive: true });
        console.log(pc.green('  create') + ' prompts/');
      }

      // Write example prompt file
      const examplePromptPath = join(promptsDir, 'example.prompt.yaml');
      if (existsSync(examplePromptPath)) {
        console.log(pc.yellow('  skip  ') + 'prompts/example.prompt.yaml already exists');
      } else {
        writeFileSync(examplePromptPath, EXAMPLE_PROMPT_YAML, 'utf-8');
        console.log(pc.green('  create') + ' prompts/example.prompt.yaml');
      }

      // Create .promptci/ directory
      const promptciDir = join(cwd, '.promptci');
      if (!existsSync(promptciDir)) {
        mkdirSync(promptciDir, { recursive: true });
        console.log(pc.green('  create') + ' .promptci/');
      }

      // Add .promptci to .gitignore if not already present
      const gitignorePath = join(cwd, '.gitignore');
      const gitignoreEntry = '.promptci/';
      if (existsSync(gitignorePath)) {
        const content = readFileSync(gitignorePath, 'utf-8');
        if (!content.includes(gitignoreEntry)) {
          writeFileSync(gitignorePath, content + '\n' + gitignoreEntry + '\n', 'utf-8');
          console.log(pc.green('  update') + ' .gitignore (added .promptci/)');
        }
      } else {
        writeFileSync(gitignorePath, gitignoreEntry + '\n', 'utf-8');
        console.log(pc.green('  create') + ' .gitignore');
      }

      console.log('');
      console.log(pc.bold(pc.green('Project initialized!')));
      console.log('');
      console.log('Next steps:');
      console.log('  1. Set your API key:  ' + pc.cyan('export OPENAI_API_KEY=sk-...'));
      console.log('  2. Edit your prompt:  ' + pc.cyan('prompts/example.prompt.yaml'));
      console.log('  3. Run evaluations:   ' + pc.cyan('promptci run'));
    });
}
