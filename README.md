# prompt-ci

**Test your LLM prompts like code.**

[![npm version](https://img.shields.io/npm/v/prompt-ci.svg)](https://www.npmjs.com/package/prompt-ci)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-passing-brightgreen.svg)](#)

prompt-ci brings software engineering discipline to prompt development. Define prompts in `.prompt.yaml`, write inline assertions, and run `promptci run` — in CI or locally — to catch regressions before they reach production.

---

## Why?

- **Prompt drift is silent.** When you tweak a prompt, you have no way to know what else broke. prompt-ci gives you a regression suite.
- **No test harness exists.** Most teams validate prompts by eyeballing outputs in a chat window. prompt-ci gives you 12 assertion types, from `contains` to `llm-judge`.
- **Manual evaluation doesn't scale.** Running prompt variants by hand across dozens of test cases is slow and inconsistent. prompt-ci parallelises it and stores every result in SQLite.

---

## Quick Start

**Step 1 — Install**

```bash
npm install -g prompt-ci
```

**Step 2 — Create a prompt file**

```yaml
# summarize.prompt.yaml
name: summarize-article
model: gpt-4o-mini
temperature: 0.3

system: You are a concise summarizer.

template: |
  Summarize the following in {{style}} style:
  {{article}}

variables:
  style:
    default: bullet-points
  article:
    required: true

tests:
  - name: contains-key-terms
    vars:
      style: bullet-points
      article: "AI is transforming healthcare..."
    assertions:
      - type: contains
        value: AI
      - type: max-tokens
        value: 300
      - type: cost-limit
        value: 0.01
```

**Step 3 — Run**

```bash
OPENAI_API_KEY=sk-... npx promptci run
```

```
prompt-ci v0.1.0

summarize-article
  contains-key-terms
    contains "AI"             PASS   12ms
    max-tokens 300            PASS    0ms
    cost-limit $0.01          PASS    0ms

Results: 3 passed, 0 failed  |  1 prompt  |  $0.0008  |  1.2s
```

Under 30 seconds from zero to green.

---

## Features

| Feature | Description |
|---|---|
| `.prompt.yaml` format | YAML frontmatter with model settings, Handlebars-style `{{variable}}` template, and inline test cases — one file per prompt |
| 12 assertion types | `contains`, `not-contains`, `regex`, `not-regex`, `json-schema`, `is-json`, `max-tokens`, `cost-limit`, `max-latency`, `llm-judge`, `similarity`, `custom-fn` |
| Multi-provider | OpenAI, Anthropic, and Ollama (local) out of the box. Pluggable `ProviderAdapter` interface for others |
| 5 reporters | Console (ANSI colours), JSON, HTML (dark theme), Markdown, and CI (GitHub Actions annotations) |
| SQLite history | Every run is stored locally. Compare scores across commits, track cost trends, query raw results |
| Variable layering | Resolution order: file defaults < test-case vars < CLI `--var` flags < environment variables |
| Retry with backoff | Automatic exponential backoff on 429 and 5xx responses. Configurable `timeoutMs` per test case |
| Security guardrails | ReDoS protection on regex assertions, SSRF blocking on provider `baseUrl`, path traversal guards on file sources |

---

## Assertion Types

| Type | What it checks | Example value |
|---|---|---|
| `contains` | Output contains a literal string | `"positive"` |
| `not-contains` | Output does not contain a string | `"error"` |
| `regex` | Output matches a regular expression | `"^(yes\|no)$"` |
| `not-regex` | Output does not match a pattern | `"\\bsorry\\b"` |
| `json-schema` | Output is valid JSON matching a schema | `{ type: object, required: [id] }` |
| `is-json` | Output is parseable JSON (any shape) | _(no value needed)_ |
| `max-tokens` | Completion used fewer than N tokens | `300` |
| `cost-limit` | Call cost was under $N | `0.01` |
| `max-latency` | Response arrived within N ms | `5000` |
| `llm-judge` | A judge model evaluates output against criteria | see below |
| `similarity` | Cosine similarity to a reference string is ≥ threshold | `{ reference: "...", threshold: 0.8 }` |
| `custom-fn` | A JavaScript function you supply returns `true` | `"(output) => output.length > 10"` |

**`llm-judge` example:**

```yaml
assertions:
  - type: llm-judge
    criteria: The summary must not introduce facts not present in the source text.
    judge:
      provider: openai
      model: gpt-4o
```

---

## `.prompt.yaml` Format

```yaml
# ── Identity ──────────────────────────────────────────────────────────────────
name: sentiment-classifier          # required; used in reports and history
description: Classify text sentiment as positive, negative, or neutral
tags: [classification, nlp]

# ── Model settings ────────────────────────────────────────────────────────────
model: gpt-4o-mini                  # required
provider: openai                    # optional; inferred from model name if omitted
temperature: 0                      # 0–2
maxTokens: 50
topP: 1.0

# ── Prompt content ────────────────────────────────────────────────────────────
system: |
  You are a sentiment classifier. Respond with ONLY one word:
  "positive", "negative", or "neutral". No explanation.

template: |
  Classify the sentiment of this text:
  "{{text}}"

# ── Variable declarations ─────────────────────────────────────────────────────
variables:
  text:
    required: true          # promptci run fails fast if not supplied

# ── Test cases ────────────────────────────────────────────────────────────────
tests:
  - name: positive-sentiment
    vars:
      text: "I absolutely love this product!"
    assertions:
      - type: contains
        value: positive
      - type: max-tokens
        value: 10

  - name: single-word-response
    vars:
      text: "This is an okay product."
    assertions:
      - type: regex
        value: "^(positive|negative|neutral)$"
```

---

## Configuration

Copy `promptci.config.example.yaml` to `promptci.config.yaml` in your project root.
API keys are always read from environment variables — never put secrets in config files.

```yaml
# promptci.config.yaml

defaultProvider: openai
defaultModel: gpt-4o-mini

providers:
  openai:
    apiKeyEnv: OPENAI_API_KEY
    # baseUrl: https://my-azure-proxy.example.com   # Azure OpenAI or custom proxy
  anthropic:
    apiKeyEnv: ANTHROPIC_API_KEY
  ollama:
    baseUrl: http://localhost:11434

# LLM-as-judge model (used for llm-judge assertions)
judge:
  provider: openai
  model: gpt-4o

# Runner settings
concurrency: 5          # parallel test case execution
timeoutMs: 30000        # per-request timeout in milliseconds

# SQLite history store location (default: .promptci/)
# storagePath: .promptci

# Active reporters
reporters:
  - console
  # - json
  # - { type: html, output: report.html }
  # - { type: markdown, output: PROMPT_REPORT.md }
  # - ci          # emits GitHub Actions annotations
```

### CLI flags

```
promptci run [glob]         Run all matched .prompt.yaml files (default: **/*.prompt.yaml)
  --reporter <type>         Override reporter (console|json|html|markdown|ci)
  --var key=value           Override a variable for every test case
  --model <model>           Override model for every prompt
  --concurrency <n>         Override concurrency
  --output <path>           File path for json/html/markdown reporters
  --fail-fast               Stop on first test failure

promptci history            List past runs stored in SQLite
promptci history <run-id>   Show detailed results for a run
```

---

## CI Integration

### GitHub Actions

```yaml
# .github/workflows/prompt-ci.yml
name: Prompt CI

on:
  push:
    paths:
      - 'prompts/**'
      - 'promptci.config.yaml'
  pull_request:
    paths:
      - 'prompts/**'

jobs:
  eval:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm install -g prompt-ci

      - name: Run prompt evaluations
        run: promptci run --reporter ci
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

The `ci` reporter emits [GitHub Actions annotations](https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/workflow-commands-for-github-actions) so failed assertions appear inline on the PR diff.

---

## Roadmap

- **Prompt versioning dashboard** — web UI to browse prompt history, diff templates across commits, and plot score trends over time
- **A/B testing** — run two prompt variants against the same test suite and get a statistical comparison in one command
- **Cost trend tracking** — per-prompt cost graphs stored in SQLite history, with budget alert thresholds in config
- **Slack / webhook notifications** — post a run summary to a Slack channel or any webhook when evaluations complete in CI
- **VS Code extension** — run evaluations for the current `.prompt.yaml` file from the editor sidebar without leaving your IDE

---

## Contributing

```bash
git clone https://github.com/your-org/prompt-ci
cd prompt-ci
npm install
npm run build
npm test
```

The monorepo uses [Turborepo](https://turbo.build/). `packages/core` contains the evaluation engine; `packages/cli` contains the `promptci` binary.

Please open an issue before submitting a large pull request. Bug fixes and documentation improvements are always welcome.

---

## License

MIT — see [LICENSE](LICENSE).
