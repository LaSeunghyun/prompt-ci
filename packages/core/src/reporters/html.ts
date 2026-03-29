/**
 * HTML reporter - generates a self-contained dark-theme HTML report.
 * All content is HTML-escaped to prevent XSS.
 */

import type { EvalRun, TestResult } from '../types.js';
import type { Reporter } from './base.js';

export class HtmlReporter implements Reporter {
  report(run: EvalRun): string {
    const { summary, results, id, startedAt, finishedAt, gitBranch, gitRef } = run;
    const passRate =
      summary.totalTests > 0
        ? ((summary.passed / summary.totalTests) * 100).toFixed(1)
        : '0.0';

    const metaParts: string[] = [
      `<span class="meta-item">Run: <code>${esc(id)}</code></span>`,
      `<span class="meta-item">Started: ${esc(startedAt)}</span>`,
      `<span class="meta-item">Finished: ${esc(finishedAt)}</span>`,
    ];
    if (gitBranch) metaParts.push(`<span class="meta-item">Branch: <code>${esc(gitBranch)}</code></span>`);
    if (gitRef)    metaParts.push(`<span class="meta-item">Ref: <code>${esc(gitRef)}</code></span>`);

    const summaryCards = `
      <div class="cards">
        <div class="card">
          <div class="card-value">${summary.totalTests}</div>
          <div class="card-label">Total Tests</div>
        </div>
        <div class="card card-pass">
          <div class="card-value">${summary.passed}</div>
          <div class="card-label">Passed</div>
        </div>
        <div class="card ${summary.failed > 0 ? 'card-fail' : ''}">
          <div class="card-value">${summary.failed}</div>
          <div class="card-label">Failed</div>
        </div>
        <div class="card">
          <div class="card-value">${passRate}%</div>
          <div class="card-label">Pass Rate</div>
        </div>
        <div class="card">
          <div class="card-value">${summary.avgScore.toFixed(3)}</div>
          <div class="card-label">Avg Score</div>
        </div>
        <div class="card">
          <div class="card-value">$${summary.totalCost.toFixed(4)}</div>
          <div class="card-label">Total Cost</div>
        </div>
        <div class="card">
          <div class="card-value">${(summary.totalDurationMs / 1000).toFixed(2)}s</div>
          <div class="card-label">Total Time</div>
        </div>
        <div class="card">
          <div class="card-value">${summary.totalTokens.toLocaleString()}</div>
          <div class="card-label">Total Tokens</div>
        </div>
      </div>`;

    const tableRows = results.map((r, i) => buildResultRow(r, i)).join('\n');

    const detailSections = results.map((r, i) => buildDetailSection(r, i)).join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Prompt CI Report — ${esc(id)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: #0f1117;
      --bg2: #1a1d27;
      --bg3: #242736;
      --border: #2e3148;
      --text: #e2e4f0;
      --text-muted: #8890b0;
      --pass: #3dd68c;
      --fail: #ff5c5c;
      --warn: #f5a623;
      --accent: #6c8ef7;
      --code-bg: #13151f;
      --radius: 8px;
      --font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace;
    }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: var(--font);
      font-size: 14px;
      line-height: 1.6;
      padding: 24px;
    }
    h1 { font-size: 22px; color: var(--accent); margin-bottom: 4px; }
    h2 { font-size: 16px; color: var(--text-muted); font-weight: 500; margin: 28px 0 12px; text-transform: uppercase; letter-spacing: 0.06em; }
    .meta { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 24px; }
    .meta-item { color: var(--text-muted); font-size: 12px; }
    .meta-item code { color: var(--text); background: var(--code-bg); padding: 1px 5px; border-radius: 4px; font-size: 11px; }
    .cards { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 28px; }
    .card {
      background: var(--bg2);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 14px 20px;
      min-width: 110px;
      flex: 1;
    }
    .card-pass { border-color: rgba(61,214,140,0.35); }
    .card-fail { border-color: rgba(255,92,92,0.35); }
    .card-value { font-size: 24px; font-weight: 700; color: var(--text); }
    .card-pass .card-value { color: var(--pass); }
    .card-fail .card-value { color: var(--fail); }
    .card-label { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; background: var(--bg2); border-radius: var(--radius); overflow: hidden; }
    thead th { background: var(--bg3); color: var(--text-muted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; padding: 10px 14px; text-align: left; border-bottom: 1px solid var(--border); }
    tbody tr { border-bottom: 1px solid var(--border); cursor: pointer; transition: background 0.1s; }
    tbody tr:hover { background: var(--bg3); }
    tbody tr:last-child { border-bottom: none; }
    td { padding: 10px 14px; vertical-align: middle; }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .badge-pass { background: rgba(61,214,140,0.15); color: var(--pass); border: 1px solid rgba(61,214,140,0.3); }
    .badge-fail { background: rgba(255,92,92,0.15); color: var(--fail); border: 1px solid rgba(255,92,92,0.3); }
    .score-high { color: var(--pass); }
    .score-mid  { color: var(--warn); }
    .score-low  { color: var(--fail); }
    .muted { color: var(--text-muted); }
    .detail-section { display: none; background: var(--bg3); border-top: 1px solid var(--border); }
    .detail-section.open { display: table-row; }
    .detail-inner { padding: 14px 20px; }
    .detail-inner h4 { color: var(--text-muted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px; }
    .response-text {
      background: var(--code-bg);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 12px;
      font-family: 'Menlo', 'Consolas', monospace;
      font-size: 12px;
      white-space: pre-wrap;
      word-break: break-word;
      max-height: 300px;
      overflow-y: auto;
      margin-bottom: 14px;
      color: var(--text);
    }
    .assertions { display: flex; flex-direction: column; gap: 6px; }
    .assertion-row {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 8px 12px;
      border-radius: 6px;
      background: var(--bg2);
      border: 1px solid var(--border);
      font-size: 12px;
    }
    .assertion-icon { font-size: 14px; flex-shrink: 0; margin-top: 1px; }
    .assertion-type { color: var(--accent); font-weight: 600; min-width: 90px; flex-shrink: 0; }
    .assertion-msg { color: var(--text); flex: 1; }
    .assertion-reasoning { color: var(--text-muted); font-style: italic; font-size: 11px; margin-top: 3px; }
    .assertion-score { color: var(--text-muted); font-size: 11px; flex-shrink: 0; }
    .expand-hint { font-size: 11px; color: var(--text-muted); float: right; }
    footer { margin-top: 40px; text-align: center; color: var(--text-muted); font-size: 11px; }
    footer a { color: var(--accent); text-decoration: none; }
    footer a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <h1>Prompt CI Eval Report</h1>
  <div class="meta">
    ${metaParts.join('\n    ')}
  </div>

  <h2>Summary</h2>
  ${summaryCards}

  <h2>Results <span class="expand-hint">Click row to expand</span></h2>
  <table>
    <thead>
      <tr>
        <th>Prompt</th>
        <th>Test</th>
        <th>Status</th>
        <th>Score</th>
        <th>Cost</th>
        <th>Latency</th>
        <th>Model</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
      ${detailSections}
    </tbody>
  </table>

  <footer>
    Generated by <a href="https://github.com/prompt-ci">Prompt CI</a> &mdash; ${esc(new Date(finishedAt).toUTCString())}
  </footer>

  <script>
    (function() {
      var rows = document.querySelectorAll('tbody tr[data-idx]');
      rows.forEach(function(row) {
        row.addEventListener('click', function() {
          var idx = row.getAttribute('data-idx');
          var detail = document.querySelector('.detail-section[data-idx="' + idx + '"]');
          if (detail) detail.classList.toggle('open');
        });
      });
    })();
  </script>
</body>
</html>`;
  }
}

function buildResultRow(r: TestResult, idx: number): string {
  const scoreClass =
    r.score >= 0.8 ? 'score-high' : r.score >= 0.5 ? 'score-mid' : 'score-low';
  const badgeClass = r.passed ? 'badge-pass' : 'badge-fail';
  const badgeText = r.passed ? 'PASS' : 'FAIL';

  return `<tr data-idx="${idx}">
        <td>${esc(r.promptName)}</td>
        <td>${esc(r.testCase.name)}</td>
        <td><span class="badge ${badgeClass}">${badgeText}</span></td>
        <td class="${scoreClass}">${r.score.toFixed(3)}</td>
        <td class="muted">$${r.response.cost.toFixed(4)}</td>
        <td class="muted">${r.response.latencyMs}ms</td>
        <td class="muted">${esc(r.response.model)}</td>
      </tr>`;
}

function buildDetailSection(r: TestResult, idx: number): string {
  const assertionRows = r.assertions
    .map((a) => {
      const icon = a.passed ? '✓' : '✗';
      const iconStyle = a.passed ? 'color: var(--pass)' : 'color: var(--fail)';
      const reasoning = a.reasoning
        ? `<div class="assertion-reasoning">${esc(a.reasoning)}</div>`
        : '';
      return `<div class="assertion-row">
              <span class="assertion-icon" style="${iconStyle}">${icon}</span>
              <span class="assertion-type">${esc(a.assertion.type)}</span>
              <div class="assertion-msg">${esc(a.message)}${reasoning}</div>
              <span class="assertion-score">score: ${a.score.toFixed(3)}</span>
            </div>`;
    })
    .join('\n');

  return `<tr class="detail-section" data-idx="${idx}">
        <td colspan="7">
          <div class="detail-inner">
            <h4>Response</h4>
            <div class="response-text">${esc(r.response.content)}</div>
            <h4>Assertions (${r.assertions.length})</h4>
            <div class="assertions">
              ${assertionRows}
            </div>
          </div>
        </td>
      </tr>`;
}

/** HTML-escape a string to prevent XSS. */
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}
