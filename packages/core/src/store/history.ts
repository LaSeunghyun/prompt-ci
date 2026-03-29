/**
 * CRUD operations for eval run history stored in SQLite.
 */

import type { Database } from 'better-sqlite3';
import type { EvalRun, TestResult, AssertionResult, RunSummary } from '../types.js';

// ---------------------------------------------------------------------------
// RunDiff types
// ---------------------------------------------------------------------------

export interface RunDiff {
  run1: RunSummary;
  run2: RunSummary;
  improved: string[];   // test names that improved (failed → passed, or higher score)
  regressed: string[];  // test names that regressed (passed → failed, or lower score)
  unchanged: string[];  // test names with same result
}

// ---------------------------------------------------------------------------
// Row shapes matching the schema
// ---------------------------------------------------------------------------

interface EvalRunRow {
  id: string;
  started_at: string;
  finished_at: string;
  git_ref: string | null;
  git_branch: string | null;
  total_tests: number;
  passed: number;
  failed: number;
  avg_score: number;
  total_cost: number;
  total_duration_ms: number;
  total_tokens: number;
}

interface TestResultRow {
  id: number;
  run_id: string;
  prompt_name: string;
  test_name: string;
  passed: number;
  score: number;
  duration_ms: number;
  model: string;
  provider: string;
  cost: number;
  latency_ms: number;
  response_content: string;
  finish_reason: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  test_case_json: string;
}

interface AssertionResultRow {
  id: number;
  test_result_id: number;
  assertion_type: string;
  passed: number;
  message: string;
  reasoning: string | null;
  score: number;
  duration_ms: number;
  assertion_json: string;
}

// ---------------------------------------------------------------------------
// saveRun
// ---------------------------------------------------------------------------

/**
 * Persist a full EvalRun (run + test results + assertion results) to SQLite.
 * Wrapped in a single transaction for atomicity.
 */
export function saveRun(db: Database, run: EvalRun): void {
  const insertRun = db.prepare(`
    INSERT OR REPLACE INTO eval_runs
      (id, started_at, finished_at, git_ref, git_branch,
       total_tests, passed, failed, avg_score,
       total_cost, total_duration_ms, total_tokens)
    VALUES
      (@id, @started_at, @finished_at, @git_ref, @git_branch,
       @total_tests, @passed, @failed, @avg_score,
       @total_cost, @total_duration_ms, @total_tokens)
  `);

  const insertTestResult = db.prepare(`
    INSERT INTO test_results
      (run_id, prompt_name, test_name, passed, score, duration_ms,
       model, provider, cost, latency_ms, response_content, finish_reason,
       prompt_tokens, completion_tokens, total_tokens, test_case_json)
    VALUES
      (@run_id, @prompt_name, @test_name, @passed, @score, @duration_ms,
       @model, @provider, @cost, @latency_ms, @response_content, @finish_reason,
       @prompt_tokens, @completion_tokens, @total_tokens, @test_case_json)
  `);

  const insertAssertion = db.prepare(`
    INSERT INTO assertion_results
      (test_result_id, assertion_type, passed, message, reasoning, score, duration_ms, assertion_json)
    VALUES
      (@test_result_id, @assertion_type, @passed, @message, @reasoning, @score, @duration_ms, @assertion_json)
  `);

  db.transaction(() => {
    insertRun.run({
      id: run.id,
      started_at: run.startedAt,
      finished_at: run.finishedAt,
      git_ref: run.gitRef ?? null,
      git_branch: run.gitBranch ?? null,
      total_tests: run.summary.totalTests,
      passed: run.summary.passed,
      failed: run.summary.failed,
      avg_score: run.summary.avgScore,
      total_cost: run.summary.totalCost,
      total_duration_ms: run.summary.totalDurationMs,
      total_tokens: run.summary.totalTokens,
    });

    for (const result of run.results) {
      const testRow = insertTestResult.run({
        run_id: run.id,
        prompt_name: result.promptName,
        test_name: result.testCase.name,
        passed: result.passed ? 1 : 0,
        score: result.score,
        duration_ms: result.durationMs,
        model: result.response.model,
        provider: result.response.provider,
        cost: result.response.cost,
        latency_ms: result.response.latencyMs,
        response_content: result.response.content,
        finish_reason: result.response.finishReason,
        prompt_tokens: result.response.usage.promptTokens,
        completion_tokens: result.response.usage.completionTokens,
        total_tokens: result.response.usage.totalTokens,
        test_case_json: JSON.stringify(result.testCase),
      });

      const testResultId = testRow.lastInsertRowid as number;

      for (const assertion of result.assertions) {
        insertAssertion.run({
          test_result_id: testResultId,
          assertion_type: assertion.assertion.type,
          passed: assertion.passed ? 1 : 0,
          message: assertion.message,
          reasoning: assertion.reasoning ?? null,
          score: assertion.score,
          duration_ms: assertion.durationMs,
          assertion_json: JSON.stringify(assertion.assertion),
        });
      }
    }
  })();
}

// ---------------------------------------------------------------------------
// getRun
// ---------------------------------------------------------------------------

/**
 * Load a full EvalRun by ID, including all test and assertion results.
 * Returns null if not found.
 */
export function getRun(db: Database, id: string): EvalRun | null {
  const runRow = db
    .prepare<string, EvalRunRow>('SELECT * FROM eval_runs WHERE id = ?')
    .get(id);

  if (!runRow) return null;

  const testRows = db
    .prepare<string, TestResultRow>('SELECT * FROM test_results WHERE run_id = ? ORDER BY id')
    .all(id);

  const results: TestResult[] = testRows.map((tr) => {
    const assertionRows = db
      .prepare<number, AssertionResultRow>(
        'SELECT * FROM assertion_results WHERE test_result_id = ? ORDER BY id',
      )
      .all(tr.id);

    const assertions: AssertionResult[] = assertionRows.map((ar) => ({
      assertion: JSON.parse(ar.assertion_json),
      passed: ar.passed === 1,
      message: ar.message,
      reasoning: ar.reasoning ?? undefined,
      score: ar.score,
      durationMs: ar.duration_ms,
    }));

    return {
      testCase: JSON.parse(tr.test_case_json),
      promptName: tr.prompt_name,
      response: {
        content: tr.response_content,
        model: tr.model,
        provider: tr.provider,
        usage: {
          promptTokens: tr.prompt_tokens,
          completionTokens: tr.completion_tokens,
          totalTokens: tr.total_tokens,
        },
        cost: tr.cost,
        latencyMs: tr.latency_ms,
        finishReason: tr.finish_reason,
      },
      assertions,
      passed: tr.passed === 1,
      score: tr.score,
      durationMs: tr.duration_ms,
    };
  });

  return {
    id: runRow.id,
    startedAt: runRow.started_at,
    finishedAt: runRow.finished_at,
    gitRef: runRow.git_ref ?? undefined,
    gitBranch: runRow.git_branch ?? undefined,
    results,
    summary: rowToSummary(runRow),
  };
}

// ---------------------------------------------------------------------------
// listRuns
// ---------------------------------------------------------------------------

/**
 * List recent runs (summary only, no test results).
 * Ordered newest-first. Defaults to 20 entries.
 */
export function listRuns(db: Database, limit = 20): Array<Omit<EvalRun, 'results'>> {
  const rows = db
    .prepare<number, EvalRunRow>(
      'SELECT * FROM eval_runs ORDER BY started_at DESC LIMIT ?',
    )
    .all(limit);

  return rows.map((row) => ({
    id: row.id,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    gitRef: row.git_ref ?? undefined,
    gitBranch: row.git_branch ?? undefined,
    summary: rowToSummary(row),
  }));
}

// ---------------------------------------------------------------------------
// diffRuns
// ---------------------------------------------------------------------------

/**
 * Compare two runs by test name, identifying which tests improved,
 * regressed, or remained unchanged between run1 and run2.
 */
export function diffRuns(db: Database, runId1: string, runId2: string): RunDiff {
  const run1 = getRun(db, runId1);
  const run2 = getRun(db, runId2);

  if (!run1) throw new Error(`Run not found: ${runId1}`);
  if (!run2) throw new Error(`Run not found: ${runId2}`);

  // Index results by "promptName / testName"
  const key = (r: TestResult): string => `${r.promptName} / ${r.testCase.name}`;

  const map1 = new Map<string, TestResult>();
  for (const r of run1.results) map1.set(key(r), r);

  const map2 = new Map<string, TestResult>();
  for (const r of run2.results) map2.set(key(r), r);

  const allKeys = new Set([...map1.keys(), ...map2.keys()]);

  const improved: string[] = [];
  const regressed: string[] = [];
  const unchanged: string[] = [];

  for (const k of allKeys) {
    const r1 = map1.get(k);
    const r2 = map2.get(k);

    if (!r1 || !r2) {
      // Test only in one run - skip comparison
      continue;
    }

    if (r1.passed === r2.passed) {
      if (r2.score > r1.score + 0.001) {
        improved.push(k);
      } else if (r1.score > r2.score + 0.001) {
        regressed.push(k);
      } else {
        unchanged.push(k);
      }
    } else if (!r1.passed && r2.passed) {
      improved.push(k);
    } else {
      regressed.push(k);
    }
  }

  return {
    run1: run1.summary,
    run2: run2.summary,
    improved,
    regressed,
    unchanged,
  };
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function rowToSummary(row: EvalRunRow): RunSummary {
  return {
    totalTests: row.total_tests,
    passed: row.passed,
    failed: row.failed,
    avgScore: row.avg_score,
    totalCost: row.total_cost,
    totalDurationMs: row.total_duration_ms,
    totalTokens: row.total_tokens,
  };
}
